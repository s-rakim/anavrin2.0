import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { seedProducts } from './seed-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, 'anavrin.db');
export const db = new DatabaseSync(DB_FILE);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    phone         TEXT,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','rider','admin')),
    status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','rejected','suspended')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rider_applications (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone         TEXT NOT NULL,
    national_id   TEXT NOT NULL,
    vehicle_type  TEXT NOT NULL,
    plate_number  TEXT,
    area          TEXT NOT NULL,
    experience    TEXT,
    about         TEXT,
    status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    reviewed_by   INTEGER REFERENCES users(id),
    reviewed_at   TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT NOT NULL,
    description         TEXT NOT NULL DEFAULT '',
    category            TEXT NOT NULL,
    price               INTEGER NOT NULL CHECK (price >= 0),
    compare_at_price    INTEGER,
    stock               INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    low_stock_threshold INTEGER NOT NULL DEFAULT 5,
    image_url           TEXT NOT NULL DEFAULT '',
    rating              REAL NOT NULL DEFAULT 4.5,
    review_count        INTEGER NOT NULL DEFAULT 0,
    active              INTEGER NOT NULL DEFAULT 1,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    code           TEXT NOT NULL UNIQUE,
    user_id        INTEGER NOT NULL REFERENCES users(id),
    phone          TEXT NOT NULL,
    instructions   TEXT NOT NULL DEFAULT '',
    subtotal       INTEGER NOT NULL,
    delivery_fee   INTEGER NOT NULL,
    total          INTEGER NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('mpesa','cash')),
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid')),
    status         TEXT NOT NULL DEFAULT 'placed'
                   CHECK (status IN ('placed','confirmed','assigned','out_for_delivery','delivered','received','cancelled')),
    rider_id       INTEGER REFERENCES users(id),
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    name       TEXT NOT NULL,
    image_url  TEXT NOT NULL DEFAULT '',
    unit_price INTEGER NOT NULL,
    quantity   INTEGER NOT NULL CHECK (quantity > 0)
  );

  CREATE TABLE IF NOT EXISTS order_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status     TEXT NOT NULL,
    note       TEXT,
    actor_id   INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id    INTEGER NOT NULL REFERENCES orders(id),
    amount      INTEGER NOT NULL,
    method      TEXT NOT NULL CHECK (method IN ('mpesa','cash')),
    reference   TEXT,
    recorded_by INTEGER REFERENCES users(id),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS stock_movements (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    change      INTEGER NOT NULL,
    reason      TEXT NOT NULL CHECK (reason IN ('order','restock','adjustment','cancel','initial')),
    stock_after INTEGER NOT NULL,
    note        TEXT,
    actor_id    INTEGER REFERENCES users(id),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_orders_user   ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_orders_rider  ON orders(rider_id);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_items_order   ON order_items(order_id);
  CREATE INDEX IF NOT EXISTS idx_events_order  ON order_events(order_id);
  CREATE INDEX IF NOT EXISTS idx_moves_product ON stock_movements(product_id);
`);

/** Run fn inside a transaction; rolls back on throw. */
export function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export const one = (sql, ...params) => db.prepare(sql).get(...params);
export const all = (sql, ...params) => db.prepare(sql).all(...params);
export const run = (sql, ...params) => db.prepare(sql).run(...params);

function seed() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@anavrin.co.ke';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@2026';
  const hasAdmin = one(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
  if (!hasAdmin) {
    const existing = one('SELECT id FROM users WHERE email = ?', adminEmail);
    if (existing) {
      run(`UPDATE users SET role = 'admin', status = 'active' WHERE id = ?`, existing.id);
    } else {
      run(
        `INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'admin')`,
        'Store Admin', adminEmail, '+254700000001', bcrypt.hashSync(adminPassword, 10),
      );
    }
    console.log(`[seed] Admin account ready: ${adminEmail}`);
  }

  const productCount = one('SELECT COUNT(*) AS n FROM products').n;
  if (productCount === 0) {
    const insert = db.prepare(`
      INSERT INTO products (name, description, category, price, compare_at_price, stock, low_stock_threshold, image_url, rating, review_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const move = db.prepare(`INSERT INTO stock_movements (product_id, change, reason, stock_after) VALUES (?, ?, 'initial', ?)`);
    tx(() => {
      for (const p of seedProducts) {
        const r = insert.run(p.name, p.description, p.category, p.price, p.compareAt ?? null, p.stock, p.lowStock ?? 5, p.image, p.rating, p.reviews);
        move.run(r.lastInsertRowid, p.stock, p.stock);
      }
    });
    console.log(`[seed] Inserted ${seedProducts.length} products`);
  }

  if (process.env.SEED_DEMO_USERS !== 'false') {
    const demo = [
      { name: 'Wanjiru Kamau', email: 'customer@anavrin.co.ke', phone: '+254712345678', role: 'customer', password: 'Customer@2026' },
      { name: 'Otieno Rider', email: 'rider@anavrin.co.ke', phone: '+254723456789', role: 'rider', password: 'Rider@2026' },
    ];
    for (const u of demo) {
      if (one('SELECT id FROM users WHERE email = ?', u.email)) continue;
      const r = run(
        `INSERT INTO users (name, email, phone, password_hash, role, status) VALUES (?, ?, ?, ?, ?, 'active')`,
        u.name, u.email, u.phone, bcrypt.hashSync(u.password, 10), u.role,
      );
      if (u.role === 'rider') {
        run(
          `INSERT INTO rider_applications (user_id, phone, national_id, vehicle_type, plate_number, area, experience, status, reviewed_at)
           VALUES (?, ?, '12345678', 'motorbike', 'KMDA 123A', 'Westlands, Nairobi', '3 years', 'approved', datetime('now'))`,
          r.lastInsertRowid, u.phone,
        );
      }
    }
  }
}

seed();
