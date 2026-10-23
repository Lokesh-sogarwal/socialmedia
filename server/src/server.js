import http from 'node:http';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { createApp } from './app.js';
import { attachSockets } from './sockets/index.js';
import { logger } from './utils/logger.js';

export async function startServer({ port = env.PORT, mongoUri = env.MONGODB_URI } = {}) {
  await connectDatabase(mongoUri);
  const app = createApp();
  const server = http.createServer(app);
  const io = attachSockets(server);
  await new Promise((resolve) => server.listen(port, resolve));
  logger.info({ port }, 'Socio API listening');

  let closing = false;
  async function shutdown(signal) {
    if (closing) return;
    closing = true;
    logger.info({ signal }, 'Shutting down');
    const force = setTimeout(() => process.exit(1), 10_000).unref();
    io.close();
    await new Promise((resolve) => server.close(resolve));
    await disconnectDatabase();
    clearTimeout(force);
    process.exit(0);
  }
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
  return { server, io };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((err) => {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  });
}
