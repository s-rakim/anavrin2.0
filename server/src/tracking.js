import { all, one, run, tx } from './db.js';
import { emit, rooms } from './realtime.js';
import { distanceMeters, latLng } from './util.js';
import { parseDate, sqliteNow } from './time.js';

const MIN_INTERVAL_MS = 2000; // accept at most one GPS fix every 2 s per rider (across all their sockets)
const TRAIL_MIN_METERS = 8; // ignore GPS jitter when recording the breadcrumb trail
const TRAIL_MAX_POINTS = 500;
const MAX_LIVE_HOURS = 8; // never share a rider's position on one order for longer than this
const lastAccepted = new Map(); // rider id -> timestamp of the last accepted fix

/**
 * Riders stream their GPS position over the socket while they have active deliveries.
 * Privacy rule: only the customer whose delivery is under way right now (the rider's current stop)
 * receives the position and gets it recorded on their order's trail. Customers whose orders are
 * waiting for pickup, or queued behind another drop-off, see no coordinates. Admins see the fleet.
 */
export function attachTracking(socket, user) {
  if (user.role !== 'rider') return;

  socket.on('rider:location', (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    const now = Date.now();
    if (now - (lastAccepted.get(user.id) || 0) < MIN_INTERVAL_MS) return reply({ ok: true, throttled: true });

    const rider = one(`SELECT id, name, role, status, current_order_id FROM users WHERE id = ?`, user.id);
    if (!rider || rider.role !== 'rider' || rider.status !== 'active') return reply({ ok: false, error: 'Not an active rider.' });

    let pos;
    try {
      pos = latLng(payload, { name: 'Your location' });
    } catch (err) {
      return reply({ ok: false, error: err.message });
    }
    if (!pos) return reply({ ok: false, error: 'Missing location.' });
    lastAccepted.set(rider.id, now);

    const heading = Number.isFinite(Number(payload.heading)) && payload.heading !== null ? ((Number(payload.heading) % 360) + 360) % 360 : null;
    const accuracy = Number.isFinite(Number(payload.accuracy)) ? Math.min(Math.max(Number(payload.accuracy), 0), 100000) : null;
    const at = sqliteNow();

    run(`UPDATE users SET last_lat = ?, last_lng = ?, last_heading = ?, last_accuracy = ?, last_location_at = ? WHERE id = ?`,
      pos.lat, pos.lng, heading, accuracy, at, rider.id);

    const stop = currentStop(rider);
    if (stop) {
      appendTrail(stop.id, rider.id, pos, heading);
      emit('order:location', { orderId: stop.id, lat: pos.lat, lng: pos.lng, heading, accuracy, at }, rooms.user(stop.user_id), rooms.admins);
    }
    const active = all(`SELECT id FROM orders WHERE rider_id = ? AND status IN ('assigned','out_for_delivery')`, rider.id);
    emit('fleet:location', {
      riderId: rider.id, name: rider.name, lat: pos.lat, lng: pos.lng, heading, accuracy, at,
      orderIds: active.map((o) => o.id), currentOrderId: stop?.id ?? null,
    }, rooms.admins);
    reply({ ok: true, sharingWith: stop ? 1 : 0 });
  });
}

/** The order the rider is delivering right now, if it is still live and within the time cap. */
function currentStop(rider) {
  if (!rider.current_order_id) return null;
  const o = one(`
    SELECT o.id, o.user_id, o.status,
           (SELECT MAX(e.created_at) FROM order_events e WHERE e.order_id = o.id AND e.status = 'out_for_delivery') AS started_at
    FROM orders o WHERE o.id = ? AND o.rider_id = ?`, rider.current_order_id, rider.id);
  if (!o || o.status !== 'out_for_delivery') return null;
  const started = parseDate(o.started_at);
  if (started && Date.now() - started.getTime() > MAX_LIVE_HOURS * 3600 * 1000) return null;
  return o;
}

/** Make `orderId` the rider's current stop (or clear it). Returns the order ids whose view changed. */
export function setCurrentStop(riderId, orderId) {
  const prev = one(`SELECT current_order_id AS id FROM users WHERE id = ?`, riderId)?.id ?? null;
  run(`UPDATE users SET current_order_id = ? WHERE id = ?`, orderId, riderId);
  return [prev, orderId].filter((id, i, a) => id && a.indexOf(id) === i);
}

/**
 * After the current stop is delivered/failed/cancelled, move on to the rider's next picked-up order
 * (the one picked up earliest), or clear. Returns the order ids whose view changed.
 */
export function advanceCurrentStop(riderId, finishedOrderId) {
  const rider = one(`SELECT current_order_id FROM users WHERE id = ?`, riderId);
  if (!rider || rider.current_order_id !== finishedOrderId) return [];
  const next = one(`
    SELECT o.id FROM orders o WHERE o.rider_id = ? AND o.status = 'out_for_delivery' AND o.id != ?
    ORDER BY (SELECT MAX(e.created_at) FROM order_events e WHERE e.order_id = o.id AND e.status = 'out_for_delivery'), o.id
    LIMIT 1`, riderId, finishedOrderId);
  return setCurrentStop(riderId, next?.id ?? null);
}

/** Any rider whose current stop is this order loses it (cancelled, reassigned...). */
export function releaseOrderStop(orderId) {
  const riders = all(`SELECT id FROM users WHERE current_order_id = ?`, orderId);
  return riders.flatMap((r) => advanceCurrentStop(r.id, orderId));
}

function appendTrail(orderId, riderId, pos, heading) {
  const last = one(`SELECT lat, lng FROM delivery_tracks WHERE order_id = ? ORDER BY id DESC LIMIT 1`, orderId);
  if (last && distanceMeters(last, pos) < TRAIL_MIN_METERS) return;
  tx(() => {
    run(`INSERT INTO delivery_tracks (order_id, rider_id, lat, lng, heading) VALUES (?, ?, ?, ?, ?)`, orderId, riderId, pos.lat, pos.lng, heading);
    run(`DELETE FROM delivery_tracks WHERE order_id = ? AND id <= (
           SELECT id FROM delivery_tracks WHERE order_id = ? ORDER BY id DESC LIMIT 1 OFFSET ?)`, orderId, orderId, TRAIL_MAX_POINTS);
  });
}

export function trailFor(orderId) {
  return all(`SELECT lat, lng, created_at AS at FROM delivery_tracks WHERE order_id = ? ORDER BY id`, orderId);
}

/** Active riders' last known positions for the admin fleet map. */
export function fleet() {
  const riders = all(`
    SELECT u.id, u.name, u.phone, u.last_lat AS lat, u.last_lng AS lng, u.last_heading AS heading, u.last_location_at AS at,
           u.current_order_id AS currentOrderId
    FROM users u WHERE u.role = 'rider' AND u.status = 'active' ORDER BY u.name`);
  const active = all(`SELECT id, code, rider_id FROM orders WHERE rider_id IS NOT NULL AND status IN ('assigned','out_for_delivery')`);
  return riders.map((r) => {
    const at = parseDate(r.at);
    return {
      ...r,
      online: !!at && Date.now() - at.getTime() < 2 * 60 * 1000,
      orders: active.filter((o) => o.rider_id === r.id).map((o) => ({ id: o.id, code: o.code })),
    };
  });
}

/**
 * Data retention: location history is personal data. Trails are dropped 30 days after an order ends,
 * a rider's last position after 7 days without updates, and Google-sourced pin data after 30 days
 * (Google Maps Platform terms allow caching Places/Geocoding coordinates for at most 30 days).
 */
export function purgeOldLocationData() {
  tx(() => {
    run(`DELETE FROM delivery_tracks WHERE order_id IN (
           SELECT id FROM orders WHERE status IN ('delivered','received','cancelled') AND updated_at < datetime('now','-30 days'))`);
    run(`UPDATE users SET last_lat = NULL, last_lng = NULL, last_heading = NULL, last_accuracy = NULL, last_location_at = NULL
         WHERE last_location_at < datetime('now','-7 days')`);
    run(`UPDATE orders SET dest_label = NULL WHERE dest_label_google = 1 AND dest_label IS NOT NULL AND created_at < datetime('now','-30 days')`);
    run(`UPDATE orders SET dest_lat = NULL, dest_lng = NULL WHERE dest_point_google = 1 AND dest_lat IS NOT NULL AND created_at < datetime('now','-30 days')`);
  });
}
