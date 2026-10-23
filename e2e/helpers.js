import sharp from 'sharp';
import { expect } from '@playwright/test';

export const API = 'http://localhost:4100/api';
let n = 0;

export function uniqueName(prefix) {
  n += 1;
  return `${prefix}${Date.now().toString(36).slice(-5)}${n}`;
}

/** Creates an account through the API (fast path for secondary users). */
export async function apiRegister(request, prefix, extra = {}) {
  const username = uniqueName(prefix);
  const res = await request.post(`${API}/auth/register`, {
    data: { username, email: `${username}@example.com`, password: 'passw0rd!', displayName: extra.displayName ?? prefix },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const token = body.data.accessToken;
  const headers = { Authorization: `Bearer ${token}` };
  if (extra.isPrivate) await request.patch(`${API}/users/me/settings`, { headers, data: { isPrivate: true } });
  return { username, password: 'passw0rd!', user: body.data.user, headers };
}

export async function uiLogin(page, { username, password }) {
  await page.goto('/login');
  await page.getByLabel('Email or username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
}

export async function pngFile(color = '#E2B4BD') {
  const buffer = await sharp({ create: { width: 800, height: 600, channels: 3, background: color } }).png().toBuffer();
  return { name: 'photo.png', mimeType: 'image/png', buffer };
}
