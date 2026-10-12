import crypto from 'node:crypto';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const bad = (message) => new HttpError(400, message);
export const notFound = (message = 'Not found.') => new HttpError(404, message);
export const forbidden = (message = 'Not allowed.') => new HttpError(403, message);

/** Wrap a handler so thrown errors reach the error middleware. */
export const h = (fn) => (req, res, next) => {
  try {
    const out = fn(req, res, next);
    if (out && typeof out.catch === 'function') out.catch(next);
  } catch (err) {
    next(err);
  }
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Normalise a Kenyan mobile number to +254XXXXXXXXX.
 * Accepts 07XXXXXXXX, 01XXXXXXXX, 7XXXXXXXX, 2547XXXXXXXX and +2547XXXXXXXX.
 */
export function normalizeKePhone(input) {
  const digits = String(input || '').replace(/[\s()-]/g, '');
  const m = digits.match(/^(?:\+?254|0)?([17]\d{8})$/);
  return m ? `+254${m[1]}` : null;
}

export function str(value, { max = 500, required = false, name = 'Field' } = {}) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (required && !s) throw bad(`${name} is required.`);
  if (s.length > max) throw bad(`${name} must be at most ${max} characters.`);
  return s;
}

export function int(value, { min = 0, max = Number.MAX_SAFE_INTEGER, name = 'Value' } = {}) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`${name} must be a whole number between ${min} and ${max}.`);
  return n;
}

export function orderCode() {
  return 'ANV-' + crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
}

export const DELIVERY_FEE = 200;
export const FREE_DELIVERY_OVER = 5000;
export const deliveryFeeFor = (subtotal) => (subtotal >= FREE_DELIVERY_OVER ? 0 : DELIVERY_FEE);

// Rough bounding box for Kenya, used to sanity-check pinned delivery destinations.
const KENYA = { minLat: -4.9, maxLat: 5.2, minLng: 33.5, maxLng: 42.2 };

/** Validate a {lat, lng} pair. With `kenya`, the point must fall inside Kenya. Returns null when absent. */
export function latLng(value, { kenya = false, name = 'Location' } = {}) {
  if (value === undefined || value === null) return null;
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw bad(`${name} is not a valid map position.`);
  }
  if (kenya && (lat < KENYA.minLat || lat > KENYA.maxLat || lng < KENYA.minLng || lng > KENYA.maxLng)) {
    throw bad('Anavrin delivers within Kenya. Move the pin to your delivery spot in Kenya.');
  }
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}

/** Great-circle distance in metres. */
export function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Where riders collect orders. Configure with STORE_LAT / STORE_LNG / STORE_NAME. */
export const STORE_LOCATION = {
  name: process.env.STORE_NAME || 'Anavrin Hub, Westlands',
  lat: Number(process.env.STORE_LAT) || -1.2676,
  lng: Number(process.env.STORE_LNG) || 36.8108,
};
