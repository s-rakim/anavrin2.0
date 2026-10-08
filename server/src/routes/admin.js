import { Router } from 'express';
import crypto from 'node:crypto';
import multer from 'multer';
import { UPLOAD_DIR, all, one, run, tx } from '../db.js';
import { publicUser, requireAuth, requireRole } from '../auth.js';
import { emit, rooms } from '../realtime.js';
import {
  addOrderEvent, broadcastMovement, broadcastOrder, broadcastProduct, getMovement, getProduct, listOrders,
  recordMovement, serializeProduct,
} from '../services.js';
import { restockOrderItems } from './orders.js';
import { riderStats } from './rider.js';
import { bad, h, int, notFound, str } from '../util.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

// ---------- Dashboard ----------

router.get('/overview', h((req, res) => {
  const n = (sql, ...p) => one(sql, ...p).n;
  const revenueSeries = all(`
    WITH RECURSIVE days(d) AS (SELECT date('now','-13 days') UNION ALL SELECT date(d,'+1 day') FROM days WHERE d < date('now'))
    SELECT d AS date,
           COALESCE((SELECT SUM(amount) FROM transactions t WHERE date(t.created_at) = d), 0) AS revenue,
           COALESCE((SELECT COUNT(*) FROM orders o WHERE date(o.created_at) = d), 0) AS orders
    FROM days`);
  const statusBreakdown = all(`SELECT status, COUNT(*) AS count FROM orders GROUP BY status`);
  const lowStock = all(`SELECT * FROM products WHERE active = 1 AND stock <= low_stock_threshold ORDER BY stock ASC, name LIMIT 12`)
    .map(serializeProduct);
  const topProducts = all(`
    SELECT oi.product_id AS id, oi.name, SUM(oi.quantity) AS units, SUM(oi.quantity * oi.unit_price) AS revenue
    FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status != 'cancelled'
    GROUP BY oi.product_id, oi.name ORDER BY units DESC LIMIT 5`);

  res.json({
    kpis: {
      revenue: n(`SELECT COALESCE(SUM(amount),0) AS n FROM transactions`),
      revenueToday: n(`SELECT COALESCE(SUM(amount),0) AS n FROM transactions WHERE date(created_at) = date('now')`),
      orders: n(`SELECT COUNT(*) AS n FROM orders`),
      openOrders: n(`SELECT COUNT(*) AS n FROM orders WHERE status IN ('placed','confirmed','assigned','out_for_delivery')`),
      awaitingConfirmation: n(`SELECT COUNT(*) AS n FROM orders WHERE status = 'placed'`),
      customers: n(`SELECT COUNT(*) AS n FROM users WHERE role = 'customer'`),
      riders: n(`SELECT COUNT(*) AS n FROM users WHERE role = 'rider' AND status = 'active'`),
      pendingApplications: n(`SELECT COUNT(*) AS n FROM rider_applications WHERE status = 'pending'`),
      products: n(`SELECT COUNT(*) AS n FROM products WHERE active = 1`),
      unitsInStock: n(`SELECT COALESCE(SUM(stock),0) AS n FROM products WHERE active = 1`),
      lowStock: n(`SELECT COUNT(*) AS n FROM products WHERE active = 1 AND stock <= low_stock_threshold`),
      outOfStock: n(`SELECT COUNT(*) AS n FROM products WHERE active = 1 AND stock = 0`),
      unpaidDelivered: n(`SELECT COUNT(*) AS n FROM orders WHERE payment_status = 'pending' AND status IN ('delivered','received')`),
    },
    revenueSeries,
    statusBreakdown,
    lowStock,
    topProducts,
    recentOrders: listOrders('WHERE o.id IN (SELECT id FROM orders ORDER BY id DESC LIMIT 6)'),
  });
}));

// ---------- Products & inventory ----------

const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/avif': '.avif', 'image/gif': '.gif' };

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    // The extension comes from the validated content type, never from the uploaded file name.
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${IMAGE_TYPES[file.mimetype]}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = Object.hasOwn(IMAGE_TYPES, file.mimetype);
    cb(ok ? null : bad('Upload a JPG, PNG, WebP, AVIF or GIF image.'), ok);
  },
});

router.post('/uploads', upload.single('image'), h((req, res) => {
  if (!req.file) throw bad('Choose an image to upload.');
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
}));

router.get('/products', h((req, res) => {
  res.json({ products: all(`SELECT * FROM products ORDER BY active DESC, category, name`).map(serializeProduct) });
}));

function productFields(body, partial) {
  const f = {};
  const has = (k) => body[k] !== undefined;
  if (!partial || has('name')) f.name = str(body.name, { required: true, max: 120, name: 'Name' });
  if (!partial || has('description')) f.description = str(body.description, { max: 2000, name: 'Description' });
  if (!partial || has('category')) f.category = str(body.category, { required: true, max: 60, name: 'Category' });
  if (!partial || has('price')) f.price = int(body.price, { min: 1, max: 10_000_000, name: 'Price' });
  if (has('compareAtPrice')) {
    f.compare_at_price = body.compareAtPrice === null || body.compareAtPrice === ''
      ? null : int(body.compareAtPrice, { min: 1, max: 10_000_000, name: 'Original price' });
  }
  if (has('lowStockThreshold')) f.low_stock_threshold = int(body.lowStockThreshold, { min: 0, max: 100000, name: 'Low-stock alert level' });
  if (!partial || has('imageUrl')) {
    f.image_url = str(body.imageUrl, { required: true, max: 1000, name: 'Image' });
    if (!/^(https?:\/\/|\/uploads\/)/.test(f.image_url)) throw bad('Image must be an uploaded file or an https:// link.');
  }
  if (has('active')) f.active = body.active ? 1 : 0;
  return f;
}

router.post('/products', h((req, res) => {
  const f = productFields(req.body, false);
  const stock = int(req.body.stock ?? 0, { min: 0, max: 1_000_000, name: 'Opening stock' });
  const { id, moveId } = tx(() => {
    const r = run(
      `INSERT INTO products (name, description, category, price, compare_at_price, stock, low_stock_threshold, image_url, rating, review_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
      f.name, f.description, f.category, f.price, f.compare_at_price ?? null, stock, f.low_stock_threshold ?? 5, f.image_url);
    return { id: r.lastInsertRowid, moveId: recordMovement(r.lastInsertRowid, stock, 'initial', req.user.id, 'New product') };
  });
  broadcastMovement(moveId);
  emit('stats:changed', {}, rooms.admins);
  res.status(201).json({ product: broadcastProduct(id) });
}));

router.patch('/products/:id', h((req, res) => {
  const id = Number(req.params.id);
  if (!one('SELECT id FROM products WHERE id = ?', id)) throw notFound('Product not found.');
  const f = productFields(req.body, true);
  const keys = Object.keys(f);
  if (keys.length) {
    run(`UPDATE products SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`,
      ...keys.map((k) => f[k]), id);
  }
  const product = broadcastProduct(id);
  if (!product.active) emit('product:removed', { id }, );
  emit('stats:changed', {}, rooms.admins);
  res.json({ product });
}));

// Restock (positive) or correct a count (negative adjustment).
router.post('/products/:id/stock', h((req, res) => {
  const id = Number(req.params.id);
  const p = one('SELECT * FROM products WHERE id = ?', id);
  if (!p) throw notFound('Product not found.');
  const mode = req.body.mode === 'set' ? 'set' : 'add';
  const note = str(req.body.note, { max: 200, name: 'Note' }) || null;
  let change;
  if (mode === 'set') change = int(req.body.quantity, { min: 0, max: 1_000_000, name: 'Stock count' }) - p.stock;
  else change = int(req.body.quantity, { min: 1, max: 1_000_000, name: 'Restock quantity' });
  if (change === 0) return res.json({ product: serializeProduct(p) });

  const moveId = tx(() => {
    run(`UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?`, change, id);
    return recordMovement(id, change, mode === 'set' ? 'adjustment' : 'restock', req.user.id, note);
  });
  broadcastMovement(moveId);
  emit('stats:changed', {}, rooms.admins);
  res.json({ product: broadcastProduct(id) });
}));

router.delete('/products/:id', h((req, res) => {
  const id = Number(req.params.id);
  if (!getProduct(id)) throw notFound('Product not found.');
  const used = one('SELECT COUNT(*) AS n FROM order_items WHERE product_id = ?', id).n;
  if (used > 0) {
    // Keep order history intact: archive instead of deleting.
    run(`UPDATE products SET active = 0, updated_at = datetime('now') WHERE id = ?`, id);
    broadcastProduct(id);
  } else {
    run('DELETE FROM products WHERE id = ?', id);
  }
  emit('product:removed', { id });
  emit('stats:changed', {}, rooms.admins);
  res.json({ ok: true, archived: used > 0 });
}));

router.get('/stock-movements', h((req, res) => {
  const limit = Math.min(Number(req.query.limit) || 60, 300);
  const ids = all('SELECT id FROM stock_movements ORDER BY id DESC LIMIT ?', limit);
  res.json({ movements: ids.map((r) => getMovement(r.id)) });
}));

// ---------- Orders ----------

router.get('/orders', h((req, res) => {
  const status = String(req.query.status || '');
  res.json({ orders: status ? listOrders('WHERE o.status = ?', status) : listOrders() });
}));

const ADMIN_TRANSITIONS = {
  confirmed: ['placed'],
  cancelled: ['placed', 'confirmed', 'assigned'],
};

router.post('/orders/:id/status', h((req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status || '');
  const order = listOrders('WHERE o.id = ?', id)[0];
  if (!order) throw notFound('Order not found.');
  if (!ADMIN_TRANSITIONS[status]?.includes(order.status)) throw bad(`Cannot change an order from "${order.status}" to "${status}".`);

  const prevRider = order.rider?.id ?? null;
  const moves = tx(() => {
    if (status === 'cancelled') {
      run(`UPDATE orders SET status = 'cancelled' WHERE id = ?`, id);
      addOrderEvent(id, 'cancelled', req.user.id, str(req.body.note, { max: 200, name: 'Reason' }) || 'Cancelled by Anavrin');
      return restockOrderItems(order, req.user.id);
    }
    run(`UPDATE orders SET status = ? WHERE id = ?`, status, id);
    addOrderEvent(id, status, req.user.id);
    return [];
  });
  if (status === 'cancelled') order.items.forEach((i) => i.productId && broadcastProduct(i.productId));
  moves.forEach(broadcastMovement);
  res.json({ order: broadcastOrder(id, { previousRiderId: prevRider }) });
}));

router.post('/orders/:id/assign', h((req, res) => {
  const id = Number(req.params.id);
  const order = listOrders('WHERE o.id = ?', id)[0];
  if (!order) throw notFound('Order not found.');
  if (!['placed', 'confirmed', 'assigned'].includes(order.status)) throw bad('Riders can only be assigned before the order leaves the store.');

  const prevRider = order.rider?.id ?? null;
  if (req.body.riderId === null) {
    run(`UPDATE orders SET rider_id = NULL, status = 'confirmed' WHERE id = ?`, id);
    addOrderEvent(id, 'confirmed', req.user.id, 'Rider unassigned');
    return res.json({ order: broadcastOrder(id, { previousRiderId: prevRider }) });
  }
  const rider = one(`SELECT * FROM users WHERE id = ? AND role = 'rider' AND status = 'active'`, Number(req.body.riderId));
  if (!rider) throw bad('Choose an active rider.');
  run(`UPDATE orders SET rider_id = ?, status = 'assigned' WHERE id = ?`, rider.id, id);
  addOrderEvent(id, 'assigned', req.user.id, `Assigned to ${rider.name}`);
  res.json({ order: broadcastOrder(id, { previousRiderId: prevRider }) });
}));

// ---------- People ----------

router.get('/users', h((req, res) => {
  const rows = all(`
    SELECT u.*,
      (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count,
      (SELECT COALESCE(SUM(total),0) FROM orders o WHERE o.user_id = u.id AND o.payment_status = 'paid') AS spent
    FROM users u ORDER BY u.id DESC`);
  res.json({ users: rows.map((u) => ({ ...publicUser(u), orderCount: u.order_count, spent: u.spent })) });
}));

router.patch('/users/:id', h((req, res) => {
  const id = Number(req.params.id);
  const u = one('SELECT * FROM users WHERE id = ?', id);
  if (!u) throw notFound('User not found.');
  if (id === req.user.id) throw bad('You cannot change your own role or status.');
  const role = req.body.role ?? u.role;
  const status = req.body.status ?? u.status;
  if (!['customer', 'rider', 'admin'].includes(role)) throw bad('Unknown role.');
  if (!['active', 'pending', 'rejected', 'suspended'].includes(status)) throw bad('Unknown status.');
  run('UPDATE users SET role = ?, status = ? WHERE id = ?', role, status, id);
  // Tell the user's open sessions to refresh their access.
  emit('session:refresh', {}, rooms.user(id));
  emit('stats:changed', {}, rooms.admins);
  res.json({ user: publicUser(one('SELECT * FROM users WHERE id = ?', id)) });
}));

router.get('/riders', h((req, res) => {
  res.json({ riders: riderStats() });
}));

router.get('/applications', h((req, res) => {
  const rows = all(`
    SELECT a.id, a.status, a.phone, a.national_id AS nationalId, a.vehicle_type AS vehicleType, a.plate_number AS plateNumber,
           a.area, a.experience, a.about, a.created_at AS createdAt, a.reviewed_at AS reviewedAt,
           u.id AS userId, u.name, u.email, r.name AS reviewedBy
    FROM rider_applications a JOIN users u ON u.id = a.user_id LEFT JOIN users r ON r.id = a.reviewed_by
    ORDER BY CASE a.status WHEN 'pending' THEN 0 ELSE 1 END, a.id DESC`);
  res.json({ applications: rows });
}));

router.post('/applications/:id/:decision(approve|reject)', h((req, res) => {
  const id = Number(req.params.id);
  const a = one('SELECT * FROM rider_applications WHERE id = ?', id);
  if (!a) throw notFound('Application not found.');
  if (a.status !== 'pending') throw bad('This application has already been reviewed.');
  const approve = req.params.decision === 'approve';
  tx(() => {
    run(`UPDATE rider_applications SET status = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?`,
      approve ? 'approved' : 'rejected', req.user.id, id);
    run(`UPDATE users SET status = ? WHERE id = ?`, approve ? 'active' : 'rejected', a.user_id);
  });
  emit('session:refresh', {}, rooms.user(a.user_id));
  emit('application:reviewed', { id, status: approve ? 'approved' : 'rejected' }, rooms.admins);
  emit('stats:changed', {}, rooms.admins);
  res.json({ ok: true });
}));

// ---------- Money ----------

router.get('/transactions', h((req, res) => {
  const rows = all(`
    SELECT t.id, t.amount, t.method, t.reference, t.created_at AS createdAt,
           o.id AS orderId, o.code AS orderCode, c.name AS customerName, r.name AS recordedBy
    FROM transactions t JOIN orders o ON o.id = t.order_id JOIN users c ON c.id = o.user_id
    LEFT JOIN users r ON r.id = t.recorded_by
    ORDER BY t.id DESC LIMIT 500`);
  const totals = one(`
    SELECT COALESCE(SUM(amount),0) AS total,
           COALESCE(SUM(CASE WHEN method='mpesa' THEN amount END),0) AS mpesa,
           COALESCE(SUM(CASE WHEN method='cash' THEN amount END),0) AS cash,
           COUNT(*) AS count FROM transactions`);
  const outstanding = one(`SELECT COALESCE(SUM(total),0) AS n FROM orders WHERE payment_status='pending' AND status NOT IN ('cancelled')`).n;
  res.json({ transactions: rows, totals: { ...totals, outstanding } });
}));

export default router;
