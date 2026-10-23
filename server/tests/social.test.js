import { describe, expect, it } from 'vitest';
import { as, createPost, createUser, pngBuffer, useDatabase } from './helpers.js';
import { Comment, Like, Post, User } from '../src/models/index.js';

useDatabase();

describe('notifications', () => {
  it('dedupes like/unlike/like and supports read state', async () => {
    const author = await createUser();
    const fan = await createUser();
    const post = await createPost(author);
    await as(fan).post(`/api/posts/${post._id}/like`);
    await as(fan).delete(`/api/posts/${post._id}/like`);
    let count = (await as(author).get('/api/notifications/unread-count')).body.data.unreadCount;
    expect(count).toBe(0); // unlike retracts
    await as(fan).post(`/api/posts/${post._id}/like`);
    await as(fan).post(`/api/posts/${post._id}/like`);
    const list = (await as(author).get('/api/notifications')).body.data;
    expect(list).toHaveLength(1);
    expect(list[0].actor.username).toBe(fan.user.username);
    await as(author).post(`/api/notifications/${list[0]._id}/read`).expect(200);
    count = (await as(author).get('/api/notifications/unread-count')).body.data.unreadCount;
    expect(count).toBe(0);
    // You never notify yourself.
    await as(author).post(`/api/posts/${post._id}/like`);
    expect((await as(author).get('/api/notifications')).body.data).toHaveLength(1);
  });

  it('cannot read someone else’s notification state', async () => {
    const a = await createUser();
    const b = await createUser();
    await as(b).post(`/api/follows/${a.user._id}`);
    const [n] = (await as(a).get('/api/notifications')).body.data;
    await as(b).post(`/api/notifications/${n._id}/read`).expect(200);
    const again = (await as(a).get('/api/notifications')).body.data;
    expect(again[0].read).toBe(false);
  });
});

describe('profile', () => {
  it('edits profile fields and uploads an avatar', async () => {
    const u = await createUser();
    const res = await as(u)
      .patch('/api/users/me')
      .send({ displayName: 'New Name', bio: 'Hello', website: 'https://example.com' })
      .expect(200);
    expect(res.body.data.user.displayName).toBe('New Name');
    await as(u).patch('/api/users/me').send({ website: 'javascript:alert(1)' }).expect(400);
    await as(u).patch('/api/users/me').send({ role: 'admin' }).expect(400); // mass assignment
    const avatar = await as(u)
      .post('/api/users/me/avatar')
      .attach('image', await pngBuffer(), { filename: 'me.png', contentType: 'image/png' })
      .expect(200);
    expect(avatar.body.data.user.avatar.url).toMatch(/\/uploads\/avatars\/.+\.webp$/);
  });
});

describe('reports and moderation', () => {
  it('lets users report and moderators remove content', async () => {
    const author = await createUser();
    const reporter = await createUser();
    const mod = await createUser();
    await User.updateOne({ _id: mod.user._id }, { role: 'moderator' });
    const post = await createPost(author, 'spam spam');
    await as(reporter).post('/api/reports').send({ targetType: 'post', target: post._id, reason: 'spam' }).expect(201);
    await as(reporter).post('/api/reports').send({ targetType: 'post', target: post._id, reason: 'spam' }).expect(201);
    await as(reporter).get('/api/reports').expect(403);
    const queue = (await as(mod).get('/api/reports').expect(200)).body.data;
    expect(queue).toHaveLength(1);
    expect(queue[0].preview.caption).toBe('spam spam');
    await as(mod).patch(`/api/reports/${queue[0]._id}`).send({ action: 'remove_content' }).expect(200);
    await as(reporter).get(`/api/posts/${post._id}`).expect(404);
    expect((await as(mod).get('/api/reports')).body.data).toHaveLength(0);
  });
});

describe('stories', () => {
  it('shows followed stories, tracks unique views and hides viewers from others', async () => {
    const author = await createUser();
    const viewer = await createUser();
    await as(viewer).post(`/api/follows/${author.user._id}`);
    const story = (
      await as(author)
        .post('/api/stories')
        .attach('media', await pngBuffer(), { filename: 's.png', contentType: 'image/png' })
        .expect(201)
    ).body.data;
    const tray = (await as(viewer).get('/api/stories/feed')).body.data;
    expect(tray[0].hasUnseen).toBe(true);
    await as(viewer).post(`/api/stories/${story._id}/view`).expect(200);
    await as(viewer).post(`/api/stories/${story._id}/view`).expect(200);
    expect((await as(viewer).get('/api/stories/feed')).body.data[0].hasUnseen).toBe(false);
    const viewers = (await as(author).get(`/api/stories/${story._id}/viewers`).expect(200)).body.data;
    expect(viewers).toHaveLength(1);
    await as(viewer).get(`/api/stories/${story._id}/viewers`).expect(404);
    const mine = (await as(author).get(`/api/stories/user/${author.user._id}`)).body.data;
    expect(mine.stories[0].viewsCount).toBe(1);
  });
});

describe('account deletion', () => {
  it('requires the password and repairs counters on other users’ content', async () => {
    const leaving = await createUser();
    const staying = await createUser();
    const post = await createPost(staying);
    await as(leaving).post(`/api/follows/${staying.user._id}`);
    await as(leaving).post(`/api/posts/${post._id}/like`);
    await as(leaving).post(`/api/posts/${post._id}/comments`).send({ body: 'bye' });
    await createPost(leaving, 'my post');

    await as(leaving).delete('/api/users/me').send({ password: 'wrong' }).expect(400);
    await as(leaving).delete('/api/users/me').send({ password: leaving.password }).expect(200);

    const p = await Post.findById(post._id).lean();
    expect(p.likesCount).toBe(0);
    expect(p.commentsCount).toBe(0);
    const s = await User.findById(staying.user._id).lean();
    expect(s.followersCount).toBe(0);
    expect(await Post.countDocuments({ author: leaving.user._id })).toBe(0);
    expect(await Comment.countDocuments({ author: leaving.user._id })).toBe(0);
    expect(await Like.countDocuments({ user: leaving.user._id })).toBe(0);
    await as(leaving).get('/api/auth/me').expect(401);
  });
});
