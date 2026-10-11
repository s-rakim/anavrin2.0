import { Router } from 'express';
import { h, latLng, str } from '../util.js';

/**
 * Place search for the open-map fallback (used only when no Google Maps key is configured),
 * proxied through the server as the OpenStreetMap Nominatim usage policy asks:
 * https://operations.osmfoundation.org/policies/nominatim/
 *  - one request per second for the whole app (a single shared queue here),
 *  - results cached, a real User-Agent with contact details,
 *  - no search-as-you-type (the client only searches on submit),
 *  - the endpoint can be switched (NOMINATIM_URL), e.g. to a self-hosted instance.
 * For production traffic, configure a Google Maps key or your own geocoder.
 */

const BASE = (process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
const USER_AGENT = `Anavrin-store/1.0 (${process.env.NOMINATIM_CONTACT || 'contact not configured'})`;
const MIN_GAP_MS = 1100;
const MAX_QUEUE = 20;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 1000;

const cache = new Map();
let chain = Promise.resolve();
let last = 0;
let pending = 0;

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

/** Run Nominatim requests strictly one at a time, at least 1.1 s apart. */
function enqueue(path) {
  if (pending >= MAX_QUEUE) {
    const err = new Error('Place search is busy. Please try again in a moment, or tap the map to drop your pin.');
    err.status = 503;
    return Promise.reject(err);
  }
  pending += 1;
  const run = chain.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - last);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw Object.assign(new Error('Place search is unavailable right now.'), { status: 502 });
    return res.json();
  }).finally(() => { pending -= 1; });
  chain = run.catch(() => {});
  return run.catch((err) => {
    throw err.status ? err : Object.assign(new Error('Place search is unavailable right now. Tap the map to drop your pin.'), { status: 502 });
  });
}

const router = Router();

router.get('/search', h(async (req, res) => {
  const q = str(req.query.q, { required: true, max: 120, name: 'Search' });
  if (q.length < 2) return res.json({ results: [] });
  const key = `s:${q.toLowerCase()}`;
  let results = cached(key);
  if (!results) {
    const rows = await enqueue(`/search?format=jsonv2&countrycodes=ke&limit=6&addressdetails=0&q=${encodeURIComponent(q)}`);
    results = rows.map((r) => {
      const [title, ...rest] = String(r.display_name).split(', ');
      return { id: String(r.place_id), title, subtitle: rest.slice(0, 3).join(', '), lat: Number(r.lat), lng: Number(r.lon) };
    });
    remember(key, results);
  }
  res.json({ results });
}));

router.get('/reverse', h(async (req, res) => {
  const pos = latLng({ lat: req.query.lat, lng: req.query.lng }, { kenya: true, name: 'Pin' });
  if (!pos) return res.json({ label: null });
  // ~11 m grid so nearby pins share a cache entry.
  const key = `r:${pos.lat.toFixed(4)},${pos.lng.toFixed(4)}`;
  let label = cached(key);
  if (label === undefined) {
    const r = await enqueue(`/reverse?format=jsonv2&zoom=17&lat=${pos.lat}&lon=${pos.lng}`);
    const a = r?.address;
    label = a
      ? [a.road || a.pedestrian || a.building || a.amenity, a.neighbourhood || a.suburb, a.city || a.town || a.county].filter(Boolean).slice(0, 3).join(', ')
        || r.display_name || null
      : r?.display_name || null;
    remember(key, label);
  }
  res.json({ label });
}));

export default router;
