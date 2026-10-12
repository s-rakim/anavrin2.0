import './env.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import { UPLOAD_DIR, db } from './db.js';
import { initRealtime } from './realtime.js';
import { rateLimit, securityHeaders } from './security.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import orderRoutes from './routes/orders.js';
import riderRoutes from './routes/rider.js';
import adminRoutes from './routes/admin.js';
import { attachTracking } from './tracking.js';
import geoRoutes from './routes/geo.js';
import { requireAuth } from './auth.js';
import { purgeOldLocationData } from './tracking.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');
const PORT = Number(process.env.PORT) || 4000;

const app = express();
app.disable('x-powered-by');
// TRUST_PROXY: unset/false = don't trust X-Forwarded-For; true = trust it; or an Express trust list
// such as "loopback, uniquelocal" (only trust proxies on private networks, e.g. a Caddy container).
const trust = process.env.TRUST_PROXY;
app.set('trust proxy', !trust || trust === 'false' ? false : trust === 'true' ? true : trust.split(',').map((x) => x.trim()));
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
app.use('/api/geo', requireAuth,
  rateLimit({ windowMs: 60 * 1000, max: 20, key: (req) => `geo:${req.user.id}`, message: 'Too many searches. Please wait a moment.' }),
  geoRoutes);
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
  if (err.expose) return res.status(status).json({ error: err.message }); // expected, user-facing errors
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on our side. Please try again.' : err.message });
});

const server = http.createServer(app);
const io = initRealtime(server, { onUser: attachTracking });

// Location data retention (see tracking.js): run now and every 6 hours.
purgeOldLocationData();
setInterval(purgeOldLocationData, 6 * 60 * 60 * 1000).unref();
server.listen(PORT, () => console.log(`Anavrin API listening on http://localhost:${PORT}`));

// Stop cleanly on `docker stop` or Ctrl+C: finish open requests, close sockets and the database.
let stopping = false;
function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`${signal} received, shutting down`);
  setTimeout(() => process.exit(1), 8000).unref();
  io.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
