import { describe, expect, it } from 'vitest';
import { as, createPost, createUser, pngBuffer, useDatabase } from './helpers.js';

useDatabase();

describe('posts', () => {
  it('creates a post with images, hashtags and mentions', async () => {
    const author = await createUser();
    const friend = await createUser({ username: 'friendly' });
    const res = await as(author)
      .post('/api/posts')
      .field('caption', 'Golden hour #Sunset #travel with @friendly')
      .attach('media', await pngBuffer(), { filename: 'a.png', contentType: 'image/png' })
      .attach('media', await pngBuffer('#4A4A4A'), { filename: 'b.png', contentType: 'image/png' })
      .expect(201);
    const post = res.body.data;
    expect(post.media).toHaveLength(2);
    expect(post.media[0].mimeType).toBe('image/webp');
    expect(post.media[0].width).toBe(64);
    expect(post.hashtags).toEqual(['sunset', 'travel']);
    expect(post.author.username).toBe(author.user.username);
    const notes = await as(friend).get('/api/notifications').expect(200);
    expect(notes.body.data.map((n) => n.type)).toContain('mention');
    const me = await as(author).get('/api/auth/me');
    expect(me.body.data.user.postsCount).toBe(1);
  });

  it('rejects files whose content is not really an image', async () => {
    const author = await createUser();
    const res = await as(author)
      .post('/api/posts')
      .field('caption', 'sneaky')
      .attach('media', Buffer.from('<script>alert(1)</script>'), { filename: 'x.png', contentType: 'image/png' })
      .expect(400);
    expect(res.body.error.message).toMatch(/does not match/);
    await as(author)
      .post('/api/posts')
      .attach('media', Buffer.from('MZ'), { filename: 'x.exe', contentType: 'application/x-msdownload' })
      .expect(400);
    await as(author).post('/api/posts').field('caption', '').expect(400);
  });

  it('only lets owners edit and delete', async () => {
    const author = await createUser();
    const stranger = await createUser();
    const post = await createPost(author, 'original');
    await as(stranger).patch(`/api/posts/${post._id}`).send({ caption: 'hacked' }).expect(403);
    await as(stranger).delete(`/api/posts/${post._id}`).expect(403);
    const edited = await as(author).patch(`/api/posts/${post._id}`).send({ caption: 'edited #new' }).expect(200);
    expect(edited.body.data.caption).toBe('edited #new');
    expect(edited.body.data.hashtags).toEqual(['new']);
    expect(edited.body.data.editedAt).toBeTruthy();
    await as(author).delete(`/api/posts/${post._id}`).expect(200);
    await as(author).get(`/api/posts/${post._id}`).expect(404);
    const me = await as(author).get('/api/auth/me');
    expect(me.body.data.user.postsCount).toBe(0);
  });

  it('keeps like counts consistent under repeated and concurrent likes', async () => {
    const author = await createUser();
    const fan = await createUser();
    const post = await createPost(author);
    await Promise.all([1, 2, 3].map(() => as(fan).post(`/api/posts/${post._id}/like`)));
    let res = await as(fan).get(`/api/posts/${post._id}`).expect(200);
    expect(res.body.data.likesCount).toBe(1);
    expect(res.body.data.likedByMe).toBe(true);
    await as(fan).delete(`/api/posts/${post._id}/like`).expect(200);
    await as(fan).delete(`/api/posts/${post._id}/like`).expect(200);
    res = await as(fan).get(`/api/posts/${post._id}`).expect(200);
    expect(res.body.data.likesCount).toBe(0);
  });

  it('bookmarks posts', async () => {
    const author = await createUser();
    const reader = await createUser();
    const post = await createPost(author);
    await as(reader).post(`/api/posts/${post._id}/bookmark`).expect(200);
    await as(reader).post(`/api/posts/${post._id}/bookmark`).expect(200);
    const saved = await as(reader).get('/api/bookmarks').expect(200);
    expect(saved.body.data).toHaveLength(1);
    expect(saved.body.data[0].bookmarkedByMe).toBe(true);
    await as(reader).delete(`/api/posts/${post._id}/bookmark`).expect(200);
    expect((await as(reader).get('/api/bookmarks')).body.data).toHaveLength(0);
  });
});

describe('comments', () => {
  it('supports replies, edits, deletes and accurate counters', async () => {
    const author = await createUser();
    const a = await createUser();
    const b = await createUser();
    const post = await createPost(author);
    const top = (await as(a).post(`/api/posts/${post._id}/comments`).send({ body: 'first!' }).expect(201)).body.data;
    const reply = (await as(b).post(`/api/posts/${post._id}/comments`).send({ body: 'reply', parent: top._id }).expect(201)).body.data;
    // Reply to a reply flattens onto the top-level comment.
    const nested = (await as(a).post(`/api/posts/${post._id}/comments`).send({ body: 'nested', parent: reply._id }).expect(201)).body.data;
    expect(nested.parent).toBe(top._id);

    let p = (await as(a).get(`/api/posts/${post._id}`)).body.data;
    expect(p.commentsCount).toBe(3);
    const tops = (await as(a).get(`/api/posts/${post._id}/comments`)).body.data;
    expect(tops).toHaveLength(1);
    expect(tops[0].repliesCount).toBe(2);
    const replies = (await as(a).get(`/api/posts/${post._id}/comments?parent=${top._id}`)).body.data;
    expect(replies.map((r) => r.body)).toEqual(['reply', 'nested']);

    await as(b).patch(`/api/comments/${top._id}`).send({ body: 'nope' }).expect(403);
    await as(a).patch(`/api/comments/${top._id}`).send({ body: 'first (edited)' }).expect(200);

    await as(a).post(`/api/comments/${reply._id}/like`).expect(200);
    await as(a).post(`/api/comments/${reply._id}/like`).expect(200);
    const liked = (await as(a).get(`/api/posts/${post._id}/comments?parent=${top._id}`)).body.data[0];
    expect(liked.likesCount).toBe(1);
    expect(liked.likedByMe).toBe(true);

    // The post author may moderate comments on their post; deleting the top comment removes its replies.
    await as(b).delete(`/api/comments/${top._id}`).expect(403);
    await as(author).delete(`/api/comments/${top._id}`).expect(200);
    p = (await as(a).get(`/api/posts/${post._id}`)).body.data;
    expect(p.commentsCount).toBe(0);
  });

  it('notifies the post author and the replied-to user', async () => {
    const author = await createUser();
    const a = await createUser();
    const b = await createUser();
    const post = await createPost(author);
    const top = (await as(a).post(`/api/posts/${post._id}/comments`).send({ body: 'hey' })).body.data;
    await as(b).post(`/api/posts/${post._id}/comments`).send({ body: 'yo', parent: top._id });
    const authorTypes = (await as(author).get('/api/notifications')).body.data.map((n) => n.type);
    expect(authorTypes.filter((t) => t === 'comment')).toHaveLength(2);
    const aTypes = (await as(a).get('/api/notifications')).body.data.map((n) => n.type);
    expect(aTypes).toEqual(['reply']);
  });
});

describe('feed and discovery', () => {
  it('shows followed accounts newest first and paginates', async () => {
    const me = await createUser();
    const followed = await createUser();
    const stranger = await createUser({ username: 'strangerdanger' });
    await as(me).post(`/api/follows/${followed.user._id}`).expect(200);
    for (let i = 0; i < 5; i += 1) await createPost(followed, `post ${i}`);
    await createPost(stranger, 'not in feed #stranger');
    const page1 = (await as(me).get('/api/feed?limit=3').expect(200)).body;
    expect(page1.data.map((p) => p.caption)).toEqual(['post 4', 'post 3', 'post 2']);
    const page2 = (await as(me).get(`/api/feed?limit=3&cursor=${page1.meta.nextCursor}`).expect(200)).body;
    expect(page2.data.map((p) => p.caption)).toEqual(['post 1', 'post 0']);
    expect(page2.meta.nextCursor).toBeNull();

    const users = (await as(me).get('/api/search?q=strang')).body.data;
    expect(users.map((u) => u.username)).toEqual(['strangerdanger']);
    const tags = (await as(me).get('/api/search?q=%23str&type=hashtags')).body.data;
    expect(tags).toEqual([{ tag: 'stranger', posts: 1 }]);
    const trending = (await as(me).get('/api/hashtags/trending')).body.data;
    expect(trending[0].tag).toBe('stranger');
  });

  it('suggests friends-of-friends', async () => {
    const me = await createUser();
    const friend = await createUser();
    const fof = await createUser({ username: 'fofuser' });
    await as(me).post(`/api/follows/${friend.user._id}`);
    await as(friend).post(`/api/follows/${fof.user._id}`);
    const sugg = (await as(me).get('/api/users/suggestions').expect(200)).body.data;
    expect(sugg[0].username).toBe('fofuser');
    expect(sugg[0].mutuals).toBe(1);
    expect(sugg.map((u) => u._id)).not.toContain(me.user._id);
    expect(sugg.map((u) => u._id)).not.toContain(friend.user._id);
  });
});
