import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { tokenStore } from './api';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io({ auth: (cb) => cb({ token: tokenStore.get() }), transports: ['websocket', 'polling'] });
  }
  return socket;
}

/**
 * Reconnect after login/logout or a role change so the server re-evaluates which rooms
 * (admins, riders, the user's own channel) this browser belongs to. Listeners stay attached.
 */
export function refreshSocket() {
  const s = getSocket();
  s.disconnect();
  s.connect();
}

/** Subscribe to a realtime event for the lifetime of the component. */
export function useSocketEvent(event, handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const s = getSocket();
    const fn = (payload) => ref.current(payload);
    s.on(event, fn);
    return () => { s.off(event, fn); };
  }, [event]);
}
