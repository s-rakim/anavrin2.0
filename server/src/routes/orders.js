import { Router } from 'express';
import { one, run, tx } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { emit, rooms } from '../realtime.js';
import {
  addOrderEvent, broadcastMovement, broadcastOrder, broadcastProduct, getOrder, listOrders, recordMovement,
} from '../services.js';
import { bad, deliveryFeeFor, forbidden, h, int, normalizeKePhone, notFound, orderCode, str } from '../util.js';

const router = Router();
router.use(requireAuth, requireRole('customer', 'admin'));

router.post('/', h((req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (items.length === 0) throw bad('Your cart is empty.');
  if (items.length > 50) throw bad('Too many different items in one order.');

  const phone = normalizeKePhone(req.body.phone);
  if (!phone) throw bad('Enter a valid Kenyan phone number, e.g. 0712 345 678.');
  const instructions = str(req.body.instructions, { required: true, max: 600, name: 'Delivery instructions' });
  const paymentMethod = req.body.paymentMethod === 'cash' ? 'cash' : 'mpesa';

  // Merge duplicate lines before validating stock.
  const wanted = new Map();
  for (const line of items) {
    const productId = int(line.productId, { min: 1, name: 'Product' });
    const quantity = int(line.quantity, { min: 1, max: 99, name: 'Quantity' });
    wanted.set(productId, (wanted.get(productId) || 0) + quantity);
  }

  const { orderId, movementIds } = tx(() => {
    const lines = [];
    for (const [productId, quantity] of wanted) {
      const p = one('SELECT * FROM products WHERE id = ? AND active = 1', productId);
      if (!p) throw bad('One of the items in your cart is no longer available.');
      if (p.stock < quantity) {
        throw bad(p.stock === 0 ? `${p.name} is out of stock.` : `Only ${p.stock} of ${p.name} left in stock.`);
      }
      lines.push({ p, quantity });
    }
    const subtotal = lines.reduce((s, l) => s + l.p.price * l.quantity, 0);
    const fee = deliveryFeeFor(subtotal);

    let code;
    do code = orderCode(); while (one('SELECT id FROM orders WHERE code = ?', code));

    const id = run(
      `INSERT INTO orders (code, user_id, phone, instructions, subtotal, delivery_fee, total, payment_method)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      code, req.user.id, phone, instructions, subtotal, fee, subtotal + fee, paymentMethod,
    ).lastInsertRowid;

    const moves = [];
    for (const { p, quantity } of lines) {
      run(`INSERT INTO order_items (order_id, product_id, name, image_url, unit_price, quantity) VALUES (?, ?, ?, ?, ?, ?)`,
        id, p.id, p.name, p.image_url, p.price, quantity);
      run(`UPDATE products SET stock = stock - ?, updated_at = datetime('now') WHERE id = ?`, quantity, p.id);
      moves.push(recordMovement(p.id, -quantity, 'order', req.user.id, code));
    }
    addOrderEvent(id, 'placed', req.user.id);
    if (!one('SELECT phone FROM users WHERE id = ?', req.user.id).phone) {
      run('UPDATE users SET phone = ? WHERE id = ?', phone, req.user.id);
    }
    return { orderId: id, movementIds: moves };
  });

  for (const productId of wanted.keys()) broadcastProduct(productId);
  movementIds.forEach(broadcastMovement);
  const order = broadcastOrder(orderId);
  emit('order:new', { id: order.id, code: order.code, total: order.total, customer: order.customer.name }, rooms.admins);
  res.status(201).json({ order });
}));

router.get('/mine', h((req, res) => {
  res.json({ orders: listOrders('WHERE o.user_id = ?', req.user.id) });
}));

function ownOrder(req) {
  const order = getOrder(Number(req.params.id));
  if (!order) throw notFound('Order not found.');
  if (order.customer.id !== req.user.id && req.user.role !== 'admin') throw forbidden();
  return order;
}

router.get('/:id', h((req, res) => {
  res.json({ order: ownOrder(req) });
}));

// Customer confirms they received the goods: closes the order.
router.post('/:id/confirm-receipt', h((req, res) => {
  const order = ownOrder(req);
  if (order.status !== 'delivered') throw bad('You can confirm receipt once the rider marks the order as delivered.');
  run(`UPDATE orders SET status = 'received' WHERE id = ?`, order.id);
  addOrderEvent(order.id, 'received', req.user.id, str(req.body.note, { max: 300, name: 'Note' }) || null);
  res.json({ order: broadcastOrder(order.id) });
}));

router.post('/:id/cancel', h((req, res) => {
  const order = ownOrder(req);
  if (!['placed', 'confirmed'].includes(order.status)) throw bad('This order can no longer be cancelled.');
  const moves = tx(() => {
    run(`UPDATE orders SET status = 'cancelled' WHERE id = ?`, order.id);
    addOrderEvent(order.id, 'cancelled', req.user.id, 'Cancelled by customer');
    return restockOrderItems(order, req.user.id);
  });
  order.items.forEach((i) => i.productId && broadcastProduct(i.productId));
  moves.forEach(broadcastMovement);
  res.json({ order: broadcastOrder(order.id) });
}));

export function restockOrderItems(order, actorId) {
  const moves = [];
  for (const item of order.items) {
    if (!item.productId) continue;
    const exists = one('SELECT id FROM products WHERE id = ?', item.productId);
    if (!exists) continue;
    run(`UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?`, item.quantity, item.productId);
    moves.push(recordMovement(item.productId, item.quantity, 'cancel', actorId, order.code));
  }
  return moves;
}

export default router;
