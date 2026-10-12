import { useEffect, useState } from 'react';
import { useMapConfig } from '../../lib/geo';

// Provider fallbacks, decided once per page and shared by every map:
//  Google Maps (key configured and accepted) -> open map (MapLibre, needs WebGL2) -> no map.
// Once a provider fails (bad key, billing off, no WebGL2, crash), every map switches to the next one.
let googleFailed = false;
let openFailed = false; // true, or 'retry' when its files couldn't be downloaded (worth trying again)
let webgl2;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

export function markGoogleFailed(reason) {
  if (googleFailed) return;
  googleFailed = true;
  console.warn(`[maps] Google Maps unavailable (${reason}); using the open map instead.`);
  notify();
}

export function markOpenMapFailed(reason, { retryable = false } = {}) {
  if (openFailed) return;
  openFailed = retryable ? 'retry' : true;
  console.warn(`[maps] Open map unavailable (${reason}).`);
  notify();
}

/** Try the open map again after a download failure (e.g. the connection came back). */
export function retryOpenMap() {
  if (openFailed !== 'retry') return;
  openFailed = false;
  notify();
}

/** MapLibre needs WebGL2, which some older/budget phones and locked-down browsers lack. */
function supportsWebGL2() {
  if (webgl2 === undefined) {
    try { webgl2 = !!document.createElement('canvas').getContext('webgl2'); } catch { webgl2 = false; }
  }
  return webgl2;
}

/**
 * Google Places and Geocoding results may only be shown on a Google map. On any other map (for example
 * after falling back from a rejected key), a pin placed from Google search is left off the map
 * (`onMap: false`) and a place name from Google is hidden. Links out to Google Maps are still fine.
 */
export function googleSafe(dest, provider) {
  if (!dest) return dest;
  if (provider === 'google') return { ...dest, onMap: true };
  return { ...dest, label: dest.googleLabel ? null : dest.label, onMap: !dest.googlePoint };
}

/** 'google' | 'open' | 'none', or null while loading config. */
export function useMapProvider() {
  const config = useMapConfig();
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  if (!config) return { provider: null, config: null };
  let provider = 'none';
  if (config.maps?.googleApiKey && !googleFailed) provider = 'google';
  else if (!openFailed && supportsWebGL2()) provider = 'open';
  return { provider, config, canRetry: provider === 'none' && openFailed === 'retry' };
}
