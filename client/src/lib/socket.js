import { io } from 'socket.io-client';
import { API_URL } from './config.js';
import { getAccessToken, refreshSession } from './api.js';

/**
 * One socket per signed-in session. The auth callback runs on every (re)connect,
 * so a refreshed access token is picked up automatically.
 */
export function createSocket() {
  const socket = io(API_URL, {
    autoConnect: false,
    withCredentials: true,
    transports: ['websocket', 'polling'],
    auth: (cb) => cb({ token: getAccessToken() }),
    reconnectionDelayMax: 10_000,
  });

  const reauthenticate = () =>
    refreshSession()
      .then(() => socket.connect())
      .catch(() => {});

  socket.on('connect_error', (err) => {
    if (err.message === 'unauthorized') reauthenticate();
  });
  // The server drops sockets whose token expired; that disables auto-reconnect, so do it ourselves.
  socket.on('disconnect', (reason) => {
    if (reason === 'io server disconnect') reauthenticate();
  });
  return socket;
}
