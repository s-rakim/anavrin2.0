import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { DATA_DIR, one } from './db.js';

function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  // Persist a generated secret so sessions survive restarts.
  const file = path.join(DATA_DIR, '.jwt-secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

const SECRET = loadSecret();

export const signToken = (user) => jwt.sign({ sub: user.id }, SECRET, { expiresIn: '7d' });

export function publicUser(u) {
  if (!u) return null;
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, status: u.status, createdAt: u.created_at };
}

/** Resolve a token to the current user row (role/status are always read fresh from the DB). */
export function userFromToken(token) {
  try {
    const { sub } = jwt.verify(token, SECRET);
    return one('SELECT * FROM users WHERE id = ?', sub) || null;
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = token && userFromToken(token);
  if (!user) return res.status(401).json({ error: 'Please log in to continue.' });
  if (user.status === 'suspended') return res.status(403).json({ error: 'This account has been suspended.' });
  req.user = user;
  next();
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have access to this area.' });
  next();
};

export function requireActive(req, res, next) {
  if (req.user.status !== 'active') return res.status(403).json({ error: 'Your account is not active yet.' });
  next();
}
