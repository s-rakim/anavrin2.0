import './env.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import { UPLOAD_DIR } from './db.js';
import { initRealtime } from './realtime.js';
import { rateLimit, securityHeaders } from './security.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import orderRoutes from './routes/orders.js';
import riderRoutes from './routes/rider.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');
const PORT = Number(process.env.PORT) || 4000;

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === 'true');
app.use(securityHeaders);
app.use(express.json({ limit: '200kb' }));

// Slow down password guessing and sign-up spam.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  key: (req) => `${req.ip}|${String(req.body?.email || '').toLowerCase()}`,
  message: 'Too many login attempts. Please wait 15 minutes and try again.',
});
const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20 });
app.use('/api/auth/login', loginLimiter);
app.use(['/api/auth/signup', '/api/auth/rider-apply'], signupLimiter);

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', fallthrough: false }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api', catalogRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/rider', riderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// Serve the built storefront in production.
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1h' }));
  app.get('*', (req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Images must be 5 MB or smaller.' : err.message });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request body.' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on our side. Please try again.' : err.message });
});

const server = http.createServer(app);
initRealtime(server);
server.listen(PORT, () => console.log(`Anavrin API listening on http://localhost:${PORT}`));
