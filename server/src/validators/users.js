import { z } from 'zod';
import { pageQuery, username } from './common.js';

const optionalUrl = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === '' || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v), 'Website must start with http:// or https://');

export const usernameParam = z.object({ username: z.string().trim().toLowerCase().min(1).max(30) }).strict();

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(1, 'Name is required').max(50).optional(),
    username: username.optional(),
    bio: z.string().trim().max(160).optional(),
    website: optionalUrl.optional(),
    location: z.string().trim().max(60).optional(),
  })
  .strict();

export const updateSettingsSchema = z
  .object({
    isPrivate: z.boolean().optional(),
    showActivityStatus: z.boolean().optional(),
  })
  .strict();

export const deleteAccountSchema = z.object({ password: z.string().min(1).max(128) }).strict();

export const userListQuery = pageQuery;
