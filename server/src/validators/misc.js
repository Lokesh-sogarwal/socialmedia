import { z } from 'zod';
import { REPORT_REASONS } from '../models/Report.js';
import { objectId, pageQuery } from './common.js';

export const searchQuery = z
  .object({
    q: z.string().trim().min(1).max(100),
    type: z.enum(['users', 'hashtags', 'posts']).default('users'),
    limit: z.coerce.number().int().min(1).max(30).default(20),
  })
  .strict();

export const hashtagParam = z
  .object({ tag: z.string().trim().toLowerCase().regex(/^[\p{L}\p{N}_]{1,50}$/u, 'Invalid hashtag') })
  .strict();

export const createReportSchema = z
  .object({
    targetType: z.enum(['user', 'post', 'comment']),
    target: objectId,
    reason: z.enum(REPORT_REASONS),
    details: z.string().trim().max(500).default(''),
  })
  .strict();

export const reportListQuery = pageQuery.extend({ status: z.enum(['open', 'dismissed', 'actioned']).default('open') });
export const resolveReportSchema = z
  .object({ action: z.enum(['dismiss', 'remove_content']) })
  .strict();

export const startConversationSchema = z.object({ userId: objectId }).strict();
export const sendMessageSchema = z
  .object({
    body: z.string().trim().min(1, 'Message cannot be empty').max(2000),
    clientId: z.string().max(64).regex(/^[A-Za-z0-9_-]+$/).optional(),
  })
  .strict();

export const createStorySchema = z.object({ caption: z.string().trim().max(200).default('') }).strict();
