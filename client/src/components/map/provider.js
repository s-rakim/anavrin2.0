import { useEffect, useState } from 'react';
import { useMapConfig } from '../../lib/geo';

// Once Google Maps fails (bad key, billing off, blocked network), every map on the page
// switches to the open-map fallback instead of showing Google's error screen.
let googleFailed = false;
const listeners = new Set();

export function markGoogleFailed(reason) {
  if (googleFailed) return;
  googleFailed = true;
  console.warn(`[maps] Google Maps unavailable (${reason}); using the open map instead.`);
  listeners.forEach((fn) => fn());
}

/** 'google' when a Maps API key is configured and working, 'open' otherwise, null while loading config. */
export function useMapProvider() {
  const config = useMapConfig();
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  if (!config) return { provider: null, config: null };
  return { provider: config.maps?.googleApiKey && !googleFailed ? 'google' : 'open', config };
}
