import { z } from 'zod';
import { objectId, pageQuery } from './common.js';

export const createPostSchema = z.object({ caption: z.string().trim().max(2200).default('') }).strict();
export const updatePostSchema = z.object({ caption: z.string().trim().max(2200) }).strict();

export const commentListQuery = pageQuery.extend({ parent: objectId.optional() });
export const createCommentSchema = z
  .object({ body: z.string().trim().min(1, 'Comment cannot be empty').max(1000), parent: objectId.optional() })
  .strict();
export const updateCommentSchema = z
  .object({ body: z.string().trim().min(1, 'Comment cannot be empty').max(1000) })
  .strict();
