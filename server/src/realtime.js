import { Server } from 'socket.io';
import { userFromToken } from './auth.js';

let io;

export const rooms = {
  admins: 'admins',
  riders: 'riders',
  user: (id) => `user:${id}`,
};

export function initRealtime(httpServer) {
  io = new Server(httpServer, { cors: { origin: true, credentials: true } });

  io.on('connection', (socket) => {
    // Everyone (including guests) receives catalogue updates such as live stock levels.
    const token = socket.handshake.auth?.token;
    const user = token ? userFromToken(token) : null;
    if (!user || user.status === 'suspended') return;

    socket.join(rooms.user(user.id));
    if (user.role === 'admin') socket.join(rooms.admins);
    if (user.role === 'rider' && user.status === 'active') socket.join(rooms.riders);
  });

  return io;
}

export function emit(event, payload, ...targets) {
  if (!io) return;
  if (targets.length === 0) io.emit(event, payload);
  else io.to(targets.filter(Boolean)).emit(event, payload);
}
