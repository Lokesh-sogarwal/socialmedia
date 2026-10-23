import { describe, expect, it } from 'vitest';
import { api, as, createUser, useDatabase } from './helpers.js';
import { testOutbox } from '../src/services/mailer.js';

useDatabase();

const xhr = { 'X-Requested-With': 'XMLHttpRequest' };

describe('auth', () => {
  it('registers, never exposes the password hash, and returns a refresh cookie', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ username: 'Alice_1', email: 'ALICE@example.com', password: 'passw0rd!', displayName: 'Alice' })
      .expect(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.username).toBe('alice_1');
    expect(res.body.data.user.email).toBe('alice@example.com');
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.accessToken).toBeTruthy();
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/socio_rt=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
  });

  it('rejects duplicate usernames and emails, weak passwords and reserved names', async () => {
    await createUser({ username: 'taken' });
    const dup = await api()
      .post('/api/auth/register')
      .send({ username: 'TAKEN', email: 'new@example.com', password: 'passw0rd!', displayName: 'X' })
      .expect(409);
    expect(dup.body.error.details.field).toBe('username');
    await api()
      .post('/api/auth/register')
      .send({ username: 'other', email: 'taken@example.com', password: 'passw0rd!', displayName: 'X' })
      .expect(409);
    await api()
      .post('/api/auth/register')
      .send({ username: 'weakling', email: 'w@example.com', password: 'password', displayName: 'X' })
      .expect(400);
    await api()
      .post('/api/auth/register')
      .send({ username: 'settings', email: 's@example.com', password: 'passw0rd!', displayName: 'X' })
      .expect(400);
  });

  it('logs in by email or username and rejects bad credentials uniformly', async () => {
    const u = await createUser({ username: 'loginuser' });
    await api().post('/api/auth/login').send({ identifier: 'loginuser', password: u.password }).expect(200);
    await api().post('/api/auth/login').send({ identifier: 'LOGINUSER@example.com', password: u.password }).expect(200);
    const wrong = await api().post('/api/auth/login').send({ identifier: 'loginuser', password: 'nope' }).expect(401);
    const missing = await api().post('/api/auth/login').send({ identifier: 'ghost', password: 'nope' }).expect(401);
    expect(wrong.body.error.message).toBe(missing.body.error.message);
  });

  it('blocks NoSQL operator injection in login', async () => {
    await createUser({ username: 'victim' });
    await api().post('/api/auth/login').send({ identifier: { $ne: null }, password: { $ne: null } }).expect(400);
    await api().post('/api/auth/login').send({ identifier: 'victim', password: { $gt: '' } }).expect(400);
  });

  it('requires a valid bearer token for protected routes', async () => {
    await api().get('/api/auth/me').expect(401);
    await api().get('/api/auth/me').set('Authorization', 'Bearer garbage').expect(401);
    const u = await createUser();
    const me = await as(u).get('/api/auth/me').expect(200);
    expect(me.body.data.user._id).toBe(u.user._id);
  });

  it('rotates refresh tokens and revokes the session when an old token is replayed', async () => {
    const u = await createUser();
    await api().post('/api/auth/refresh').set('Cookie', u.cookie).expect(403); // missing CSRF header
    const first = await api().post('/api/auth/refresh').set(xhr).set('Cookie', u.cookie).expect(200);
    const rotated = first.headers['set-cookie'];
    expect(first.body.data.accessToken).toBeTruthy();
    // Replaying the original token is treated as theft: the whole session dies.
    await api().post('/api/auth/refresh').set(xhr).set('Cookie', u.cookie).expect(401);
    await api().post('/api/auth/refresh').set(xhr).set('Cookie', rotated).expect(401);
  });

  it('logout revokes the refresh token', async () => {
    const u = await createUser();
    await api().post('/api/auth/logout').set(xhr).set('Cookie', u.cookie).expect(200);
    await api().post('/api/auth/refresh').set(xhr).set('Cookie', u.cookie).expect(401);
  });

  it('verifies email with a single-use token', async () => {
    testOutbox.length = 0;
    const u = await createUser({ username: 'verifyme' });
    const mail = testOutbox.find((m) => m.to === 'verifyme@example.com');
    const token = new URL(mail.link).searchParams.get('token');
    await api().post('/api/auth/verify-email').send({ token }).expect(200);
    await api().post('/api/auth/verify-email').send({ token }).expect(400);
    const me = await as(u).get('/api/auth/me').expect(200);
    expect(me.body.data.user.emailVerified).toBe(true);
  });

  it('resets a password, invalidating old sessions and access tokens', async () => {
    const u = await createUser({ username: 'forgetful' });
    testOutbox.length = 0;
    await api().post('/api/auth/forgot-password').send({ email: 'forgetful@example.com' }).expect(200);
    await api().post('/api/auth/forgot-password').send({ email: 'nobody@example.com' }).expect(200);
    expect(testOutbox).toHaveLength(1);
    const token = new URL(testOutbox[0].link).searchParams.get('token');
    await new Promise((r) => setTimeout(r, 1100)); // let iat move past the old token
    await api().post('/api/auth/reset-password').send({ token, password: 'newpassw0rd' }).expect(200);
    await api().post('/api/auth/login').send({ identifier: 'forgetful', password: u.password }).expect(401);
    await api().post('/api/auth/login').send({ identifier: 'forgetful', password: 'newpassw0rd' }).expect(200);
    await api().post('/api/auth/refresh').set(xhr).set('Cookie', u.cookie).expect(401);
    await as(u).get('/api/auth/me').expect(401);
  });
});
