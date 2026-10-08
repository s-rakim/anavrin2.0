import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { one, run, tx } from '../db.js';
import { publicUser, requireAuth, signToken } from '../auth.js';
import { emit, rooms } from '../realtime.js';
import { EMAIL_RE, bad, h, normalizeKePhone, str } from '../util.js';

const router = Router();

function validateAccount(body) {
  const name = str(body.name, { required: true, max: 80, name: 'Full name' });
  const email = str(body.email, { required: true, max: 120, name: 'Email' }).toLowerCase();
  if (!EMAIL_RE.test(email)) throw bad('Enter a valid email address.');
  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < 8) throw bad('Password must be at least 8 characters.');
  if (one('SELECT id FROM users WHERE email = ?', email)) throw bad('An account with this email already exists.');
  return { name, email, password };
}

// Customer sign up. No session is issued: customers are sent to the login page afterwards.
router.post('/signup', h((req, res) => {
  const { name, email, password } = validateAccount(req.body);
  const phone = req.body.phone ? normalizeKePhone(req.body.phone) : null;
  if (req.body.phone && !phone) throw bad('Enter a valid Kenyan phone number, e.g. 0712 345 678.');
  const r = run(
    `INSERT INTO users (name, email, phone, password_hash, role, status) VALUES (?, ?, ?, ?, 'customer', 'active')`,
    name, email, phone, bcrypt.hashSync(password, 10),
  );
  emit('user:new', publicUser(one('SELECT * FROM users WHERE id = ?', r.lastInsertRowid)), rooms.admins);
  emit('stats:changed', {}, rooms.admins);
  res.status(201).json({ ok: true });
}));

// Rider sign up = job application. The account stays "pending" until an admin hires the rider.
router.post('/rider-apply', h((req, res) => {
  const { name, email, password } = validateAccount(req.body);
  const phone = normalizeKePhone(req.body.phone);
  if (!phone) throw bad('Enter a valid Kenyan phone number, e.g. 0712 345 678.');
  const nationalId = str(req.body.nationalId, { required: true, max: 20, name: 'National ID number' });
  if (!/^\d{6,10}$/.test(nationalId)) throw bad('National ID number should be 6 to 10 digits.');
  const vehicleType = str(req.body.vehicleType, { required: true, max: 20, name: 'Vehicle type' });
  if (!['motorbike', 'bicycle', 'car', 'tuktuk', 'on_foot'].includes(vehicleType)) throw bad('Choose a vehicle type.');
  const plateNumber = str(req.body.plateNumber, { max: 20, name: 'Plate number' });
  const area = str(req.body.area, { required: true, max: 120, name: 'Preferred delivery area' });
  const experience = str(req.body.experience, { max: 60, name: 'Experience' });
  const about = str(req.body.about, { max: 600, name: 'About you' });

  const appId = tx(() => {
    const u = run(
      `INSERT INTO users (name, email, phone, password_hash, role, status) VALUES (?, ?, ?, ?, 'rider', 'pending')`,
      name, email, phone, bcrypt.hashSync(password, 10),
    );
    return run(
      `INSERT INTO rider_applications (user_id, phone, national_id, vehicle_type, plate_number, area, experience, about)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      u.lastInsertRowid, phone, nationalId, vehicleType, plateNumber, area, experience, about,
    ).lastInsertRowid;
  });
  emit('application:new', { id: appId }, rooms.admins);
  emit('stats:changed', {}, rooms.admins);
  res.status(201).json({ ok: true });
}));

// One login for everyone. The account's role decides where the app sends them.
router.post('/login', h((req, res) => {
  const email = str(req.body.email, { required: true, name: 'Email' }).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = one('SELECT * FROM users WHERE email = ?', email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  if (user.status === 'suspended') return res.status(403).json({ error: 'This account has been suspended. Contact Anavrin support.' });
  res.json({ token: signToken(user), user: publicUser(user) });
}));

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
