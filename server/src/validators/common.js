import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');
export const idParam = z.object({ id: objectId }).strict();

export const pageQuery = z
  .object({
    cursor: objectId.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^[a-z0-9_.]+$/, 'Use only letters, numbers, underscores and periods')
  .refine((v) => !RESERVED.has(v), 'That username is reserved');

export const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), 'Password must include a letter and a number');

const RESERVED = new Set([
  'admin', 'administrator', 'api', 'auth', 'explore', 'login', 'logout', 'me', 'messages', 'moderation',
  'notifications', 'root', 'saved', 'search', 'settings', 'signup', 'socio', 'support', 'system',
]);
