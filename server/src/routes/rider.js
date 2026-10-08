import { Router } from 'express';
import { all, one, run, tx } from '../db.js';
import { requireActive, requireAuth, requireRole } from '../auth.js';
import { emit, rooms } from '../realtime.js';
import { addOrderEvent, broadcastOrder, getOrder, listOrders, poolView } from '../services.js';
import { bad, forbidden, h, notFound, str } from '../util.js';

const router = Router();
router.use(requireAuth, requireRole('rider'));

// Available to pending/rejected riders so they can see where their application stands.
router.get('/application', h((req, res) => {
  const a = one(
    `SELECT id, status, vehicle_type AS vehicleType, area, created_at AS createdAt, reviewed_at AS reviewedAt
     FROM rider_applications WHERE user_id = ? ORDER BY id DESC LIMIT 1`, req.user.id);
  res.json({ application: a || null });
}));

router.use(requireActive);

router.get('/summary', h((req, res) => {
  const id = req.user.id;
  const n = (sql, ...p) => one(sql, ...p).n;
  res.json({
    active: n(`SELECT COUNT(*) AS n FROM orders WHERE rider_id = ? AND status IN ('assigned','out_for_delivery')`, id),
    deliveredToday: n(`SELECT COUNT(*) AS n FROM orders o WHERE rider_id = ? AND status IN ('delivered','received')
                       AND EXISTS (SELECT 1 FROM order_events e WHERE e.order_id = o.id AND e.status = 'delivered' AND date(e.created_at) = date('now'))`, id),
    deliveredTotal: n(`SELECT COUNT(*) AS n FROM orders WHERE rider_id = ? AND status IN ('delivered','received')`, id),
    collectedToday: one(`SELECT COALESCE(SUM(amount),0) AS n FROM transactions WHERE recorded_by = ? AND date(created_at) = date('now')`, id).n,
    available: n(`SELECT COUNT(*) AS n FROM orders WHERE status = 'confirmed' AND rider_id IS NULL`),
  });
}));

router.get('/orders', h((req, res) => {
  res.json({ orders: listOrders('WHERE o.rider_id = ?', req.user.id) });
}));

router.get('/available', h((req, res) => {
  res.json({ orders: listOrders(`WHERE o.status = 'confirmed' AND o.rider_id IS NULL`).map(poolView) });
}));

function myOrder(req) {
  const order = getOrder(Number(req.params.id));
  if (!order) throw notFound('Order not found.');
  if (order.rider?.id !== req.user.id) throw forbidden('This delivery is not assigned to you.');
  return order;
}

router.post('/orders/:id/claim', h((req, res) => {
  const id = Number(req.params.id);
  const claimed = tx(() => {
    const r = run(`UPDATE orders SET rider_id = ?, status = 'assigned' WHERE id = ? AND status = 'confirmed' AND rider_id IS NULL`, req.user.id, id);
    if (r.changes === 0) return false;
    addOrderEvent(id, 'assigned', req.user.id, `Picked up by ${req.user.name}`);
    return true;
  });
  if (!claimed) throw bad('Another rider has already taken this delivery.');
  res.json({ order: broadcastOrder(id) });
}));

router.post('/orders/:id/pickup', h((req, res) => {
  const order = myOrder(req);
  if (order.status !== 'assigned') throw bad('Only newly assigned orders can be marked as on the way.');
  run(`UPDATE orders SET status = 'out_for_delivery' WHERE id = ?`, order.id);
  addOrderEvent(order.id, 'out_for_delivery', req.user.id);
  res.json({ order: broadcastOrder(order.id) });
}));

router.post('/orders/:id/payment', h((req, res) => {
  const order = myOrder(req);
  if (order.paymentStatus === 'paid') throw bad('Payment for this order is already confirmed.');
  if (!['assigned', 'out_for_delivery', 'delivered'].includes(order.status)) throw bad('This order is not active.');
  const method = req.body.method === 'cash' ? 'cash' : 'mpesa';
  const reference = str(req.body.reference, { max: 20, name: 'M-Pesa code' }).toUpperCase();
  if (method === 'mpesa' && !/^[A-Z0-9]{8,12}$/.test(reference)) throw bad('Enter the M-Pesa confirmation code, e.g. SJK4H7XQ2P.');

  const txId = tx(() => {
    run(`UPDATE orders SET payment_status = 'paid', payment_method = ? WHERE id = ?`, method, order.id);
    addOrderEvent(order.id, 'payment_confirmed', req.user.id,
      method === 'mpesa' ? `M-Pesa ${reference}` : 'Cash collected');
    return run(`INSERT INTO transactions (order_id, amount, method, reference, recorded_by) VALUES (?, ?, ?, ?, ?)`,
      order.id, order.total, method, method === 'mpesa' ? reference : null, req.user.id).lastInsertRowid;
  });
  const updated = broadcastOrder(order.id);
  emit('transaction:new', { id: txId, orderCode: order.code, amount: order.total, method }, rooms.admins);
  res.json({ order: updated });
}));

router.post('/orders/:id/deliver', h((req, res) => {
  const order = myOrder(req);
  if (!['assigned', 'out_for_delivery'].includes(order.status)) throw bad('This order cannot be marked as delivered.');
  if (order.paymentStatus !== 'paid') throw bad('Confirm payment before marking the order as delivered.');
  run(`UPDATE orders SET status = 'delivered' WHERE id = ?`, order.id);
  addOrderEvent(order.id, 'delivered', req.user.id, str(req.body.note, { max: 300, name: 'Note' }) || null);
  res.json({ order: broadcastOrder(order.id) });
}));

export default router;

export function riderStats() {
  return all(`
    SELECT u.id, u.name, u.email, u.phone, u.status, u.created_at AS createdAt,
           a.vehicle_type AS vehicleType, a.area,
           (SELECT COUNT(*) FROM orders o WHERE o.rider_id = u.id AND o.status IN ('assigned','out_for_delivery')) AS active,
           (SELECT COUNT(*) FROM orders o WHERE o.rider_id = u.id AND o.status IN ('delivered','received')) AS delivered
    FROM users u
    LEFT JOIN rider_applications a ON a.id = (SELECT MAX(id) FROM rider_applications WHERE user_id = u.id)
    WHERE u.role = 'rider' AND u.status = 'active'
    ORDER BY u.name`);
}
