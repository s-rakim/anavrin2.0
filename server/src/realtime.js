import { Server } from 'socket.io';
import { userFromToken } from './auth.js';

let io;

export const rooms = {
  admins: 'admins',
  riders: 'riders',
  user: (id) => `user:${id}`,
};

/** `onUser(socket, user)` lets other modules attach handlers for signed-in sockets. */
export function initRealtime(httpServer, { onUser } = {}) {
  io = new Server(httpServer, { cors: { origin: true, credentials: true } });

  io.on('connection', (socket) => {
    // Everyone (including guests) receives catalogue updates such as live stock levels.
    const token = socket.handshake.auth?.token;
    const user = token ? userFromToken(token) : null;
    if (!user || user.status === 'suspended') return;

    socket.join(rooms.user(user.id));
    if (user.role === 'admin') socket.join(rooms.admins);
    if (user.role === 'rider' && user.status === 'active') socket.join(rooms.riders);
    onUser?.(socket, user);
  });

  return io;
}

/**
 * Re-evaluate a user's access after their role or status changed: their open sockets leave the
 * privileged rooms immediately (the client reconnects and re-joins from fresh database state).
 * Suspended users are disconnected outright.
 */
export function resetUserRooms(userId, { disconnect = false } = {}) {
  if (!io) return;
  const sockets = io.in(rooms.user(userId));
  if (disconnect) sockets.disconnectSockets(true);
  else sockets.socketsLeave([rooms.admins, rooms.riders]);
}

export function emit(event, payload, ...targets) {
  if (!io) return;
  if (targets.length === 0) io.emit(event, payload);
  else io.to(targets.filter(Boolean)).emit(event, payload);
}
