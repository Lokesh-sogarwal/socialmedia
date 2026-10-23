import mongoose from 'mongoose';
import request from 'supertest';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { connectDatabase } from '../src/config/db.js';

export const app = createApp();
export const api = () => request(app);

export function useDatabase() {
  beforeAll(async () => {
    await connectDatabase(process.env.MONGODB_URI);
  });
  beforeEach(async () => {
    await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
  });
  afterAll(async () => {
    await mongoose.disconnect();
  });
}

let seq = 0;
export async function createUser(overrides = {}) {
  seq += 1;
  const username = overrides.username ?? `user${seq}_${Date.now() % 100000}`;
  const body = {
    username,
    email: `${username}@example.com`,
    password: 'passw0rd!',
    displayName: overrides.displayName ?? `User ${seq}`,
  };
  const res = await api().post('/api/auth/register').send(body).expect(201);
  const user = res.body.data.user;
  const token = res.body.data.accessToken;
  const cookie = res.headers['set-cookie'];
  const auth = (req) => req.set('Authorization', `Bearer ${token}`);
  if (overrides.isPrivate) {
    await auth(api().patch('/api/users/me/settings')).send({ isPrivate: true }).expect(200);
  }
  return { user, token, cookie, password: body.password, auth };
}

export function as(u) {
  const wrap = (method) => (url) => api()[method](url).set('Authorization', `Bearer ${u.token}`);
  return { get: wrap('get'), post: wrap('post'), patch: wrap('patch'), delete: wrap('delete') };
}

export async function pngBuffer(color = '#E2B4BD') {
  return sharp({ create: { width: 64, height: 48, channels: 3, background: color } }).png().toBuffer();
}

export async function createPost(u, caption = 'hello world') {
  const res = await as(u).post('/api/posts').field('caption', caption).expect(201);
  return res.body.data;
}
