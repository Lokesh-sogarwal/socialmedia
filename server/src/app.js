import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { isDatabaseReady } from './config/db.js';
import { logger } from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { uploadRoot } from './services/storage.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import followRoutes from './routes/follows.js';
import postRoutes from './routes/posts.js';
import commentRoutes from './routes/comments.js';
import {
  bookmarkRoutes,
  conversationRoutes,
  feedRoutes,
  hashtagRoutes,
  notificationRoutes,
  reportRoutes,
  searchRoutes,
  storyRoutes,
} from './routes/misc.js';

/** Defence in depth: drop keys that look like Mongo operators from JSON bodies. */
function stripOperatorKeys(value) {
  if (Array.isArray(value)) return value.map(stripOperatorKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => !k.startsWith('$') && !k.includes('.'))
        .map(([k, v]) => [k, stripOperatorKeys(v)]),
    );
  }
  return value;
}

export function createApp() {
  const app = express();
  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // Uploaded media is embedded by the client app on a different origin.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.clientOrigins.includes(origin)),
      credentials: true,
    }),
  );
  if (!env.isTest) app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url.startsWith('/uploads') } }));

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/ready', (_req, res) => {
    const ready = isDatabaseReady();
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'unavailable' });
  });

  if (env.STORAGE_DRIVER === 'local') {
    app.use(
      '/uploads',
      express.static(path.resolve(uploadRoot), {
        maxAge: '30d',
        immutable: true,
        setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
      }),
    );
  }

  app.use(express.json({ limit: '100kb' }));
  app.use((req, _res, next) => {
    if (req.body && typeof req.body === 'object') req.body = stripOperatorKeys(req.body);
    next();
  });
  app.use(cookieParser());
  app.use('/api', globalLimiter);

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/follows', followRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/comments', commentRoutes);
  app.use('/api/feed', feedRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/hashtags', hashtagRoutes);
  app.use('/api/bookmarks', bookmarkRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/conversations', conversationRoutes);
  app.use('/api/stories', storyRoutes);
  app.use('/api/reports', reportRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
