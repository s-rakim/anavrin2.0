import { useEffect, useRef, useState } from 'react';
import { api } from './api';

/** Nairobi CBD: the default map centre. */
export const NAIROBI = { lat: -1.286389, lng: 36.817223 };

export function distanceMeters(a, b) {
  if (!a || !b) return null;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(m) {
  if (m == null) return '';
  return m < 950 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(m < 9500 ? 1 : 0)} km`;
}

/**
 * Rough ETA for a motorbike in Kenyan city traffic. Road distance is ~1.35× the straight line;
 * average speed ~22 km/h. Good enough for "about 12 min", not for routing.
 */
export function etaMinutes(m) {
  if (m == null) return null;
  return Math.max(1, Math.round(((m * 1.35) / 1000 / 22) * 60));
}

/** Open turn-by-turn directions in the Google Maps app (falls back to the website on desktop). */
export function directionsUrl(dest, mode = 'two-wheeler') {
  return `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=${mode}&dir_action=navigate`;
}

/** Open a dropped pin in Google Maps. */
export function pinUrl(p) {
  return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
}

export const formatLatLng = (p) => (p ? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` : '');

let configPromise = null;
/** Public runtime config: Google Maps key/map id (if any) and the store's pickup location. */
export function loadMapConfig() {
  if (!configPromise) {
    configPromise = api('/config').catch(() => ({ maps: {}, store: { name: 'Anavrin Hub', ...NAIROBI } }));
  }
  return configPromise;
}

export function useMapConfig() {
  const [config, setConfig] = useState(null);
  useEffect(() => { let on = true; loadMapConfig().then((c) => on && setConfig(c)); return () => { on = false; }; }, []);
  return config;
}

/**
 * Glide a marker from its previous position to a new one instead of jumping,
 * so live rider updates read as smooth movement.
 */
export function useAnimatedPosition(target, duration = 1200) {
  const [pos, setPos] = useState(target);
  const from = useRef(target);
  const frame = useRef(0);
  useEffect(() => {
    if (!target) { setPos(null); from.current = null; return undefined; }
    const start = from.current;
    if (!start || (start.lat === target.lat && start.lng === target.lng)
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      from.current = target;
      setPos(target);
      return undefined;
    }
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / duration);
      const e = 1 - (1 - k) ** 3;
      const p = { ...target, lat: start.lat + (target.lat - start.lat) * e, lng: start.lng + (target.lng - start.lng) * e };
      from.current = p;
      setPos(p);
      if (k < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target?.lat, target?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return pos;
}
