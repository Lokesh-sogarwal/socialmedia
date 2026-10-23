import { z } from 'zod';

// Mirrors the server rules so users get instant feedback; the server remains authoritative.
export const usernameRule = z
  .string()
  .trim()
  .min(3, 'At least 3 characters')
  .max(30, 'At most 30 characters')
  .regex(/^[a-zA-Z0-9_.]+$/, 'Letters, numbers, underscores and periods only');

export const passwordRule = z
  .string()
  .min(8, 'At least 8 characters')
  .max(128, 'At most 128 characters')
  .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), 'Include at least one letter and one number');

/** Strength meter carried over from the original register.js. */
export function passwordStrength(password = '') {
  if (password.length < 8) return { score: 0, label: 'Too short' };
  let variety = 0;
  if (/[a-z]/.test(password)) variety += 1;
  if (/[A-Z]/.test(password)) variety += 1;
  if (/[0-9]/.test(password)) variety += 1;
  if (/[^a-zA-Z0-9]/.test(password)) variety += 1;
  if (variety < 2) return { score: 1, label: 'Weak' };
  if (variety < 4) return { score: 2, label: 'Medium' };
  return { score: 3, label: 'Strong' };
}

/** Copies server field errors (details[].path = "body.field") into react-hook-form. */
export function applyServerErrors(err, setError, fallbackField = 'root') {
  const details = Array.isArray(err?.details) ? err.details : [];
  let applied = false;
  for (const d of details) {
    const field = d.path?.replace(/^body\./, '');
    if (field) {
      setError(field, { message: d.message });
      applied = true;
    }
  }
  if (err?.details?.field) {
    setError(err.details.field, { message: err.message });
    applied = true;
  }
  if (!applied) setError(fallbackField, { message: err?.message || 'Something went wrong' });
}
