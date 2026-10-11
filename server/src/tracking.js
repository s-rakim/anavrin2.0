import { all, one, run } from './db.js';
import { emit, rooms } from './realtime.js';
import { distanceMeters, latLng } from './util.js';
import { parseDate, sqliteNow } from './time.js';

const MIN_INTERVAL_MS = 2000; // accept at most one GPS fix every 2 s per rider
const TRAIL_MIN_METERS = 8; // ignore GPS jitter when recording the breadcrumb trail
const TRAIL_MAX_POINTS = 500;

/**
 * Riders stream their GPS position over the socket while they have active deliveries.
 * Each fix is saved as the rider's last known position, appended to the trail of every order
 * they are carrying, and relayed live to those customers and to admins.
 */
export function attachTracking(socket, user) {
  if (user.role !== 'rider') return;
  let lastAccepted = 0;

  socket.on('rider:location', (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    const rider = one(`SELECT id, name, role, status FROM users WHERE id = ?`, user.id);
    if (!rider || rider.role !== 'rider' || rider.status !== 'active') return reply({ ok: false, error: 'Not an active rider.' });

    const now = Date.now();
    if (now - lastAccepted < MIN_INTERVAL_MS) return reply({ ok: true, throttled: true });

    let pos;
    try {
      pos = latLng(payload, { name: 'Your location' });
    } catch (err) {
      return reply({ ok: false, error: err.message });
    }
    if (!pos) return reply({ ok: false, error: 'Missing location.' });
    lastAccepted = now;

    const heading = Number.isFinite(Number(payload.heading)) && payload.heading !== null ? ((Number(payload.heading) % 360) + 360) % 360 : null;
    const accuracy = Number.isFinite(Number(payload.accuracy)) ? Math.min(Math.max(Number(payload.accuracy), 0), 100000) : null;
    const at = sqliteNow();

    run(`UPDATE users SET last_lat = ?, last_lng = ?, last_heading = ?, last_accuracy = ?, last_location_at = ? WHERE id = ?`,
      pos.lat, pos.lng, heading, accuracy, at, rider.id);

    const orders = all(`SELECT id, user_id, status FROM orders WHERE rider_id = ? AND status IN ('assigned','out_for_delivery')`, rider.id);
    for (const o of orders) {
      if (o.status === 'out_for_delivery') appendTrail(o.id, rider.id, pos, heading);
      emit('order:location', { orderId: o.id, lat: pos.lat, lng: pos.lng, heading, accuracy, at },
        rooms.user(o.user_id), rooms.admins);
    }
    emit('fleet:location', {
      riderId: rider.id, name: rider.name, lat: pos.lat, lng: pos.lng, heading, accuracy, at,
      orderIds: orders.map((o) => o.id),
    }, rooms.admins);
    reply({ ok: true, orders: orders.length });
  });
}

function appendTrail(orderId, riderId, pos, heading) {
  const last = one(`SELECT lat, lng FROM delivery_tracks WHERE order_id = ? ORDER BY id DESC LIMIT 1`, orderId);
  if (last && distanceMeters(last, pos) < TRAIL_MIN_METERS) return;
  run(`INSERT INTO delivery_tracks (order_id, rider_id, lat, lng, heading) VALUES (?, ?, ?, ?, ?)`, orderId, riderId, pos.lat, pos.lng, heading);
  const { n } = one(`SELECT COUNT(*) AS n FROM delivery_tracks WHERE order_id = ?`, orderId);
  if (n > TRAIL_MAX_POINTS) {
    run(`DELETE FROM delivery_tracks WHERE id IN (SELECT id FROM delivery_tracks WHERE order_id = ? ORDER BY id LIMIT ?)`, orderId, n - TRAIL_MAX_POINTS);
  }
}

export function trailFor(orderId) {
  return all(`SELECT lat, lng, created_at AS at FROM delivery_tracks WHERE order_id = ? ORDER BY id`, orderId);
}

/** Active riders' last known positions for the admin fleet map. */
export function fleet() {
  const riders = all(`
    SELECT u.id, u.name, u.phone, u.last_lat AS lat, u.last_lng AS lng, u.last_heading AS heading, u.last_location_at AS at
    FROM users u WHERE u.role = 'rider' AND u.status = 'active' ORDER BY u.name`);
  const active = all(`SELECT id, code, rider_id FROM orders WHERE rider_id IS NOT NULL AND status IN ('assigned','out_for_delivery')`);
  return riders.map((r) => {
    const at = parseDate(r.at);
    return {
      ...r,
      online: !!at && Date.now() - at.getTime() < 5 * 60 * 1000,
      orders: active.filter((o) => o.rider_id === r.id).map((o) => ({ id: o.id, code: o.code })),
    };
  });
}
