// Boots the API against a throwaway in-memory MongoDB for end-to-end tests.
import os from 'node:os';
import path from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mongo = await MongoMemoryServer.create();
Object.assign(process.env, {
  NODE_ENV: 'development',
  PORT: '4100',
  MONGODB_URI: `${mongo.getUri()}socio-e2e`,
  CLIENT_ORIGINS: 'http://localhost:5174',
  PUBLIC_SERVER_URL: 'http://localhost:4100',
  APP_URL: 'http://localhost:5174',
  JWT_ACCESS_SECRET: 'e2e-access-secret-that-is-definitely-long-enough',
  JWT_REFRESH_SECRET: 'e2e-refresh-secret-that-is-definitely-long-enough',
  UPLOAD_DIR: path.join(os.tmpdir(), `socio-e2e-uploads-${process.pid}`),
  RATE_LIMIT_DISABLED: 'true',
  LOG_LEVEL: 'warn',
});

const { startServer } = await import('../server/src/server.js');
await startServer();
process.on('exit', () => mongo.stop());
