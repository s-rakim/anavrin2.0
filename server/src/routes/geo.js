import { Router } from 'express';
import { h, latLng, str } from '../util.js';

/**
 * Place search for the open-map fallback (used only when no Google Maps key is configured),
 * proxied through the server as the OpenStreetMap Nominatim usage policy asks:
 * https://operations.osmfoundation.org/policies/nominatim/
 *  - one request per second for the whole app (a single shared queue here),
 *  - results cached, a real User-Agent with contact details,
 *  - no search-as-you-type (the client only searches on submit),
 *  - the endpoint can be switched (NOMINATIM_URL), e.g. to a self-hosted instance,
 *  - signed-in users only, with a fair share of the queue each, so one client can't block everyone.
 * For production traffic, configure a Google Maps key or your own geocoder.
 */

const BASE = (process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
const USER_AGENT = `Anavrin-store/1.0 (${process.env.NOMINATIM_CONTACT || 'contact not configured'})`;
const MIN_GAP_MS = 1100;
const MAX_QUEUE = 20;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 1000;

const MAX_PER_USER = 2; // a single shopper can hold at most this many places in the queue

const cache = new Map();
const inFlight = new Map(); // identical concurrent lookups share one upstream request
const perUser = new Map(); // user id -> queued/in-flight count
let chain = Promise.resolve();
let last = 0;
let pending = 0;

/** Expected, user-facing failures: shown as-is and not logged as server errors. */
const fail = (status, message) => Object.assign(new Error(message), { status, expose: true });

function cached(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) { cache.delete(key); return undefined; }
  return hit.value;
}

function remember(key, value) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { value, at: Date.now() });
}

/** Run Nominatim requests strictly one at a time, at least 1.1 s apart, with fair per-user limits. */
function lookup(key, path, userId, shape) {
  const hit = cached(key);
  if (hit !== undefined) return Promise.resolve(hit);
  if (inFlight.has(key)) return inFlight.get(key);
  if (pending >= MAX_QUEUE) {
    return Promise.reject(fail(503, 'Place search is busy. Try again in a moment, or tap the map to drop your pin.'));
  }
  if ((perUser.get(userId) || 0) >= MAX_PER_USER) {
    return Promise.reject(fail(429, 'Please wait for your last search to finish.'));
  }
  pending += 1;
  perUser.set(userId, (perUser.get(userId) || 0) + 1);
  const run = chain.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - last);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const value = shape(await res.json());
    remember(key, value);
    return value;
  });
  chain = run.catch(() => {});
  const settled = run
    .catch(() => { throw fail(502, 'Place search is unavailable right now. Tap the map to drop your pin.'); })
    .finally(() => {
      pending -= 1;
      inFlight.delete(key);
      const n = (perUser.get(userId) || 1) - 1;
      if (n <= 0) perUser.delete(userId); else perUser.set(userId, n);
    });
  inFlight.set(key, settled);
  return settled;
}

const router = Router();

router.get('/search', h(async (req, res) => {
  const q = str(req.query.q, { required: true, max: 120, name: 'Search' });
  if (q.length < 2) return res.json({ results: [] });
  const results = await lookup(`s:${q.toLowerCase()}`,
    `/search?format=jsonv2&countrycodes=ke&limit=6&addressdetails=0&q=${encodeURIComponent(q)}`, req.user.id,
    (rows) => rows.map((r) => {
      const [title, ...rest] = String(r.display_name).split(', ');
      return { id: String(r.place_id), title, subtitle: rest.slice(0, 3).join(', '), lat: Number(r.lat), lng: Number(r.lon) };
    }));
  res.json({ results });
}));

router.get('/reverse', h(async (req, res) => {
  const pos = latLng({ lat: req.query.lat, lng: req.query.lng }, { kenya: true, name: 'Pin' });
  if (!pos) return res.json({ label: null });
  // ~11 m grid so nearby pins share a cache entry.
  const lat = pos.lat.toFixed(4);
  const lng = pos.lng.toFixed(4);
  const label = await lookup(`r:${lat},${lng}`, `/reverse?format=jsonv2&zoom=17&lat=${lat}&lon=${lng}`, req.user.id, (r) => {
    const a = r?.address;
    return a
      ? [a.road || a.pedestrian || a.building || a.amenity, a.neighbourhood || a.suburb, a.city || a.town || a.county].filter(Boolean).slice(0, 3).join(', ')
        || r.display_name || null
      : r?.display_name || null;
  });
  res.json({ label });
}));

export default router;
