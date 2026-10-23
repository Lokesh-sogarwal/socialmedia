import { Router } from 'express';
import { z } from 'zod';
import * as feed from '../controllers/feedController.js';
import * as discovery from '../controllers/discoveryController.js';
import * as notifications from '../controllers/notificationController.js';
import * as conversations from '../controllers/conversationController.js';
import * as stories from '../controllers/storyController.js';
import * as reports from '../controllers/reportController.js';
import { listBookmarks } from '../controllers/postController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { messageLimiter, uploadLimiter, writeLimiter } from '../middleware/rateLimit.js';
import { storyMediaUpload } from '../middleware/upload.js';
import { idParam, pageQuery } from '../validators/common.js';
import {
  createReportSchema,
  createStorySchema,
  hashtagParam,
  reportListQuery,
  resolveReportSchema,
  searchQuery,
  sendMessageSchema,
  startConversationSchema,
} from '../validators/misc.js';

export const feedRoutes = Router()
  .use(requireAuth)
  .get('/', validate({ query: pageQuery }), feed.homeFeed)
  .get('/explore', validate({ query: pageQuery }), feed.exploreFeed)
  .get('/reels', validate({ query: pageQuery }), feed.reelsFeed);

export const searchRoutes = Router().get('/', requireAuth, validate({ query: searchQuery }), discovery.search);

export const hashtagRoutes = Router()
  .use(requireAuth)
  .get('/trending', discovery.trendingHashtags)
  .get('/:tag/posts', validate({ params: hashtagParam, query: pageQuery }), discovery.hashtagPosts);

export const bookmarkRoutes = Router().get('/', requireAuth, validate({ query: pageQuery }), listBookmarks);

export const notificationRoutes = Router()
  .use(requireAuth)
  .get('/', validate({ query: pageQuery }), notifications.listNotifications)
  .get('/unread-count', notifications.unreadCount)
  .post('/read-all', notifications.markAllRead)
  .post('/:id/read', validate({ params: idParam }), notifications.markRead);

const conversationListQuery = z
  .object({ before: z.coerce.date().optional(), limit: z.coerce.number().int().min(1).max(50).default(30) })
  .strict();

export const conversationRoutes = Router()
  .use(requireAuth)
  .get('/', validate({ query: conversationListQuery }), conversations.listConversations)
  .get('/unread-count', conversations.unreadConversationCount)
  .post('/', writeLimiter, validate({ body: startConversationSchema }), conversations.startConversation)
  .get('/:id', validate({ params: idParam }), conversations.getConversation)
  .get('/:id/messages', validate({ params: idParam, query: pageQuery }), conversations.listMessages)
  .post('/:id/messages', messageLimiter, validate({ params: idParam, body: sendMessageSchema }), conversations.sendMessage)
  .post('/:id/read', validate({ params: idParam }), conversations.markConversationRead);

export const storyRoutes = Router()
  .use(requireAuth)
  .get('/feed', stories.storyFeed)
  .post('/', uploadLimiter, storyMediaUpload, validate({ body: createStorySchema }), stories.createStory)
  .get('/user/:id', validate({ params: idParam }), stories.userStories)
  .post('/:id/view', validate({ params: idParam }), stories.viewStory)
  .get('/:id/viewers', validate({ params: idParam }), stories.storyViewers)
  .delete('/:id', validate({ params: idParam }), stories.deleteStory);

export const reportRoutes = Router()
  .use(requireAuth)
  .post('/', writeLimiter, validate({ body: createReportSchema }), reports.createReport)
  .get('/', requireRole('moderator', 'admin'), validate({ query: reportListQuery }), reports.listReports)
  .patch('/:id', requireRole('moderator', 'admin'), validate({ params: idParam, body: resolveReportSchema }), reports.resolveReport);
