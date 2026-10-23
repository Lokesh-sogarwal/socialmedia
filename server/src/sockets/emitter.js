/**
 * Thin indirection over the Socket.IO server so services can push events
 * without importing the socket layer (and so tests can run without sockets).
 */
let io = null;

export function setIo(server) {
  io = server;
}

export function userRoom(userId) {
  return `user:${userId}`;
}

export function emitToUser(userId, event, payload) {
  if (io) io.to(userRoom(userId)).emit(event, payload);
}

export function isUserOnline(userId) {
  return Boolean(io?.sockets.adapter.rooms.get(userRoom(userId))?.size);
}
