import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../../lib/socket';

const SEND_EVERY_MS = 4000; // the server accepts one fix every 2 s; 4 s keeps data use low
const HEARTBEAT_MS = 15000; // resend while standing still so "updated x ago" stays fresh

/**
 * Watches the rider's GPS while `enabled` and streams it to the server, which relays it to the
 * customers whose orders the rider is carrying. Returns { status, position, error }.
 * status: 'off' | 'starting' | 'sharing' | 'denied' | 'unavailable' | 'unsupported'
 */
export function useLocationSharing(enabled) {
  const [state, setState] = useState({ status: 'off', position: null, error: null });
  const lastSent = useRef(0);
  const lastPos = useRef(null);

  useEffect(() => {
    if (!enabled) { setState((s) => ({ ...s, status: 'off', error: null })); return undefined; }
    if (!('geolocation' in navigator)) { setState({ status: 'unsupported', position: null, error: 'This browser can’t share location.' }); return undefined; }

    const send = (p) => {
      lastSent.current = Date.now();
      getSocket().emit('rider:location', p, (ack) => {
        if (ack && ack.ok === false) setState((s) => ({ ...s, error: ack.error || 'Location not accepted.' }));
      });
    };

    setState((s) => ({ ...s, status: 'starting', error: null }));
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const c = pos.coords;
        const p = {
          lat: c.latitude,
          lng: c.longitude,
          heading: Number.isFinite(c.heading) && c.speed > 0.5 ? c.heading : null,
          accuracy: c.accuracy,
        };
        lastPos.current = p;
        setState({ status: 'sharing', position: p, error: null });
        if (Date.now() - lastSent.current >= SEND_EVERY_MS) send(p);
      },
      (err) => {
        setState((s) => ({
          ...s,
          status: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable',
          error: err.code === err.PERMISSION_DENIED
            ? 'Location is blocked. Allow location for this site so customers can follow you.'
            : 'Waiting for a GPS signal…',
        }));
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    const heartbeat = setInterval(() => {
      if (lastPos.current && Date.now() - lastSent.current >= HEARTBEAT_MS) send(lastPos.current);
    }, 5000);

    // Browsers pause GPS when the screen sleeps, so keep it awake while delivering (where supported).
    let wakeLock = null;
    let stopped = false;
    const keepAwake = async () => {
      if (stopped || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (stopped) lock.release().catch(() => {}); // sharing ended while the request was pending
        else wakeLock = lock;
      } catch { /* denied or unsupported */ }
    };
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      keepAwake();
      if (lastPos.current) send(lastPos.current); // resume promptly after the rider comes back
    };
    keepAwake();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped = true;
      navigator.geolocation.clearWatch(watchId);
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', onVisible);
      wakeLock?.release().catch(() => {});
    };
  }, [enabled]);

  return state;
}
