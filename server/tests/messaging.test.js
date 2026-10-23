import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connect } from 'socket.io-client';
import { app, as, createUser, useDatabase } from './helpers.js';
import { attachSockets } from '../src/sockets/index.js';

useDatabase();

let server;
let url;
const sockets = [];

beforeAll(async () => {
  server = http.createServer(app);
  attachSockets(server);
  await new Promise((r) => server.listen(0, r));
  url = `http://localhost:${server.address().port}`;
});

afterAll(async () => {
  sockets.forEach((s) => s.close());
  await new Promise((r) => server.close(r));
});

function socketFor(u) {
  return new Promise((resolve, reject) => {
    const s = connect(url, { auth: { token: u.token }, transports: ['websocket'], reconnection: false });
    sockets.push(s);
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

const next = (socket, event, ms = 3000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), ms);
    socket.once(event, (payload) => {
      clearTimeout(t);
      resolve(payload);
    });
  });

describe('messaging', () => {
  it('rejects unauthenticated sockets', async () => {
    await expect(
      new Promise((resolve, reject) => {
        const s = connect(url, { auth: { token: 'bad' }, transports: ['websocket'], reconnection: false });
        sockets.push(s);
        s.on('connect', resolve);
        s.on('connect_error', (e) => reject(e));
      }),
    ).rejects.toThrow('unauthorized');
  });

  it('delivers messages in real time and tracks unread/read state', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const bobSocket = await socketFor(bob);

    const convo = (await as(alice).post('/api/conversations').send({ userId: bob.user._id }).expect(200)).body.data;
    const again = (await as(alice).post('/api/conversations').send({ userId: bob.user._id }).expect(200)).body.data;
    expect(again._id).toBe(convo._id);

    const incoming = next(bobSocket, 'message:new');
    await as(alice).post(`/api/conversations/${convo._id}/messages`).send({ body: 'hi bob', clientId: 'c1' }).expect(201);
    const { message, conversation } = await incoming;
    expect(message.body).toBe('hi bob');
    expect(conversation.unread).toBe(1);

    // Retrying with the same clientId does not duplicate the message.
    await as(alice).post(`/api/conversations/${convo._id}/messages`).send({ body: 'hi bob', clientId: 'c1' }).expect(200);
    const history = (await as(bob).get(`/api/conversations/${convo._id}/messages`)).body.data;
    expect(history).toHaveLength(1);

    expect((await as(bob).get('/api/conversations/unread-count')).body.data.unreadCount).toBe(1);
    await as(bob).post(`/api/conversations/${convo._id}/read`).expect(200);
    expect((await as(bob).get('/api/conversations/unread-count')).body.data.unreadCount).toBe(0);
    const aliceView = (await as(alice).get('/api/conversations')).body.data[0];
    expect(aliceView.otherLastReadAt).toBeTruthy();
  });

  it('forbids outsiders from reading or posting to a conversation', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const eve = await createUser();
    const convo = (await as(alice).post('/api/conversations').send({ userId: bob.user._id })).body.data;
    await as(eve).get(`/api/conversations/${convo._id}`).expect(404);
    await as(eve).get(`/api/conversations/${convo._id}/messages`).expect(404);
    await as(eve).post(`/api/conversations/${convo._id}/messages`).send({ body: 'intrude' }).expect(404);
    await as(eve).post(`/api/conversations/${convo._id}/read`).expect(404);

    // Typing events from non-members are dropped.
    const bobSocket = await socketFor(bob);
    const eveSocket = await socketFor(eve);
    let leaked = false;
    bobSocket.once('typing', () => {
      leaked = true;
    });
    eveSocket.emit('typing', { conversationId: convo._id, isTyping: true });
    await new Promise((r) => setTimeout(r, 300));
    expect(leaked).toBe(false);

    const aliceSocket = await socketFor(alice);
    const typing = next(bobSocket, 'typing');
    aliceSocket.emit('typing', { conversationId: convo._id, isTyping: true });
    expect((await typing).userId).toBe(alice.user._id);
  });

  it('requires a follow relationship to message a private account', async () => {
    const priv = await createUser({ isPrivate: true });
    const fan = await createUser();
    await as(fan).post('/api/conversations').send({ userId: priv.user._id }).expect(403);
    // The private user can still reach out first if they follow the other person.
    await as(priv).post(`/api/follows/${fan.user._id}`).expect(200);
    await as(fan).post('/api/conversations').send({ userId: priv.user._id }).expect(200);
  });

  it('stops delivery once a participant is blocked', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const convo = (await as(alice).post('/api/conversations').send({ userId: bob.user._id })).body.data;
    await as(bob).post(`/api/users/${alice.user._id}/block`).expect(200);
    await as(alice).post(`/api/conversations/${convo._id}/messages`).send({ body: 'hello?' }).expect(403);
  });
});
