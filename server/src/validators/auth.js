import { z } from 'zod';
import { password, username } from './common.js';

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email').max(254));

export const registerSchema = z
  .object({
    username,
    email,
    password,
    displayName: z.string().trim().min(1, 'Name is required').max(50),
  })
  .strict();

export const loginSchema = z
  .object({
    identifier: z.string().trim().toLowerCase().min(1, 'Enter your email or username').max(254),
    password: z.string().min(1, 'Enter your password').max(128),
  })
  .strict();

export const tokenSchema = z.object({ token: z.string().min(10).max(200) }).strict();
export const forgotSchema = z.object({ email }).strict();
export const resetSchema = z.object({ token: z.string().min(10).max(200), password }).strict();
export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(128), newPassword: password })
  .strict();
