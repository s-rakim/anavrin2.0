import { all, one, run } from './db.js';
import { emit, rooms } from './realtime.js';
import { parseDate } from './time.js';

export function serializeProduct(p) {
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    price: p.price,
    compareAtPrice: p.compare_at_price,
    stock: p.stock,
    lowStockThreshold: p.low_stock_threshold,
    imageUrl: p.image_url,
    rating: p.rating,
    reviewCount: p.review_count,
    active: !!p.active,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export const getProduct = (id) => serializeProduct(one('SELECT * FROM products WHERE id = ?', id));

export function broadcastProduct(id) {
  const product = getProduct(id);
  if (product) emit('product:updated', product);
  return product;
}

export function recordMovement(productId, change, reason, actorId, note = null) {
  const { stock } = one('SELECT stock FROM products WHERE id = ?', productId);
  const r = run(
    `INSERT INTO stock_movements (product_id, change, reason, stock_after, note, actor_id) VALUES (?, ?, ?, ?, ?, ?)`,
    productId, change, reason, stock, note, actorId ?? null,
  );
  return r.lastInsertRowid;
}

export function getMovement(id) {
  return one(
    `SELECT m.id, m.product_id AS productId, p.name AS productName, m.change, m.reason, m.stock_after AS stockAfter,
            m.note, m.created_at AS createdAt, u.name AS actorName
     FROM stock_movements m JOIN products p ON p.id = m.product_id LEFT JOIN users u ON u.id = m.actor_id
     WHERE m.id = ?`, id);
}

export function broadcastMovement(id) {
  const m = getMovement(id);
  if (m) emit('stock:movement', m, rooms.admins);
}

export function addOrderEvent(orderId, status, actorId, note = null) {
  run(`INSERT INTO order_events (order_id, status, note, actor_id) VALUES (?, ?, ?, ?)`, orderId, status, note, actorId ?? null);
  run(`UPDATE orders SET updated_at = datetime('now') WHERE id = ?`, orderId);
}

const ORDER_SELECT = `
  SELECT o.*, c.name AS customer_name, c.email AS customer_email,
         r.name AS rider_name, r.phone AS rider_phone,
         r.last_lat AS rider_lat, r.last_lng AS rider_lng, r.last_heading AS rider_heading, r.last_location_at AS rider_location_at
  FROM orders o
  JOIN users c ON c.id = o.user_id
  LEFT JOIN users r ON r.id = o.rider_id`;

function shapeOrder(o) {
  const items = all(
    `SELECT id, product_id AS productId, name, image_url AS imageUrl, unit_price AS unitPrice, quantity
     FROM order_items WHERE order_id = ? ORDER BY id`, o.id);
  const events = all(
    `SELECT e.id, e.status, e.note, e.created_at AS createdAt, u.name AS actorName, u.role AS actorRole
     FROM order_events e LEFT JOIN users u ON u.id = e.actor_id WHERE e.order_id = ? ORDER BY e.id`, o.id);
  const transaction = one(
    `SELECT id, amount, method, reference, created_at AS createdAt FROM transactions WHERE order_id = ? ORDER BY id DESC LIMIT 1`, o.id) || null;
  return {
    id: o.id,
    code: o.code,
    status: o.status,
    paymentStatus: o.payment_status,
    paymentMethod: o.payment_method,
    phone: o.phone,
    instructions: o.instructions,
    subtotal: o.subtotal,
    deliveryFee: o.delivery_fee,
    total: o.total,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    customer: { id: o.user_id, name: o.customer_name, email: o.customer_email },
    rider: o.rider_id ? { id: o.rider_id, name: o.rider_name, phone: o.rider_phone } : null,
    destination: o.dest_lat != null ? { lat: o.dest_lat, lng: o.dest_lng, label: o.dest_label || null } : null,
    riderLocation: riderLocationFor(o),
    items,
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
    events,
    transaction,
  };
}

// A rider's position is only shared while they are actively handling the order, and only if it is fresh.
const LIVE_STATUSES = ['assigned', 'out_for_delivery'];
const LOCATION_MAX_AGE_MS = 30 * 60 * 1000;

function riderLocationFor(o) {
  if (!o.rider_id || !LIVE_STATUSES.includes(o.status) || o.rider_lat == null) return null;
  const at = parseDate(o.rider_location_at);
  if (!at || Date.now() - at.getTime() > LOCATION_MAX_AGE_MS) return null;
  return { lat: o.rider_lat, lng: o.rider_lng, heading: o.rider_heading, at: o.rider_location_at };
}

export const isLiveStatus = (status) => LIVE_STATUSES.includes(status);

export function getOrder(id) {
  const o = one(`${ORDER_SELECT} WHERE o.id = ?`, id);
  return o ? shapeOrder(o) : null;
}

export function listOrders(where = '', ...params) {
  return all(`${ORDER_SELECT} ${where} ORDER BY o.id DESC`, ...params).map(shapeOrder);
}

/** Unassigned orders riders can claim: no buyer contact details until claimed. */
export function poolView(order) {
  return {
    id: order.id,
    code: order.code,
    status: order.status,
    total: order.total,
    paymentMethod: order.paymentMethod,
    itemCount: order.itemCount,
    items: order.items.map(({ name, quantity }) => ({ name, quantity })),
    // Rounded to ~1 km so riders can judge the trip before accepting, without exposing the exact spot.
    approxDestination: order.destination
      ? { lat: Math.round(order.destination.lat * 100) / 100, lng: Math.round(order.destination.lng * 100) / 100 }
      : null,
    createdAt: order.createdAt,
  };
}

export const isPoolOrder = (o) => o.status === 'confirmed' && !o.rider;

/** Push an order change to everyone who should see it. */
export function broadcastOrder(id, { previousRiderId = null } = {}) {
  const order = getOrder(id);
  if (!order) return null;
  emit('order:updated', order, rooms.admins, rooms.user(order.customer.id), order.rider && rooms.user(order.rider.id));
  if (previousRiderId && previousRiderId !== order.rider?.id) {
    emit('order:removed', { id: order.id }, rooms.user(previousRiderId));
  }
  if (isPoolOrder(order)) emit('pool:upsert', poolView(order), rooms.riders);
  else emit('pool:remove', { id: order.id }, rooms.riders);
  emit('stats:changed', {}, rooms.admins);
  return order;
}
