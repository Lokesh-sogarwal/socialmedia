import { describe, expect, it } from 'vitest';
import { api, as, createPost, createUser, useDatabase } from './helpers.js';

useDatabase();

describe('private accounts', () => {
  it('hides posts until a follow request is accepted', async () => {
    const owner = await createUser({ isPrivate: true });
    const fan = await createUser();
    const post = await createPost(owner, 'secret');

    const profile = await as(fan).get(`/api/users/${owner.user.username}`).expect(200);
    expect(profile.body.data.canView).toBe(false);
    await as(fan).get(`/api/users/${owner.user.username}/posts`).expect(403);
    await as(fan).get(`/api/posts/${post._id}`).expect(404);
    await api().get(`/api/posts/${post._id}`).expect(404); // anonymous
    await as(fan).post(`/api/posts/${post._id}/like`).expect(404);

    const follow = await as(fan).post(`/api/follows/${owner.user._id}`).expect(200);
    expect(follow.body.data.status).toBe('pending');
    await as(fan).get(`/api/posts/${post._id}`).expect(404);

    const requests = await as(owner).get('/api/follows/requests').expect(200);
    expect(requests.body.data).toHaveLength(1);
    await as(owner).post(`/api/follows/requests/${fan.user._id}/accept`).expect(200);

    await as(fan).get(`/api/posts/${post._id}`).expect(200);
    const feed = await as(fan).get('/api/feed').expect(200);
    expect(feed.body.data.map((p) => p._id)).toContain(post._id);

    const after = await as(fan).get(`/api/users/${owner.user.username}`).expect(200);
    expect(after.body.data.user.followersCount).toBe(1);
  });

  it('keeps private posts out of explore and hashtag pages for non-followers', async () => {
    const owner = await createUser({ isPrivate: true });
    const other = await createUser();
    await createPost(owner, 'hidden #sunset');
    await createPost(other, 'visible #sunset');
    const viewer = await createUser();
    const tag = await as(viewer).get('/api/hashtags/sunset/posts').expect(200);
    expect(tag.body.data.map((p) => p.caption)).toEqual(['visible #sunset']);
  });

  it('going public approves pending requests', async () => {
    const owner = await createUser({ isPrivate: true });
    const fan = await createUser();
    await as(fan).post(`/api/follows/${owner.user._id}`).expect(200);
    await as(owner).patch('/api/users/me/settings').send({ isPrivate: false }).expect(200);
    const rel = await as(fan).get(`/api/users/${owner.user.username}`).expect(200);
    expect(rel.body.data.relationship.followStatus).toBe('accepted');
    expect(rel.body.data.user.followersCount).toBe(1);
  });
});

describe('blocking', () => {
  it('removes follows both ways, hides the profile and prevents interaction', async () => {
    const a = await createUser();
    const b = await createUser();
    await as(a).post(`/api/follows/${b.user._id}`).expect(200);
    await as(b).post(`/api/follows/${a.user._id}`).expect(200);
    const post = await createPost(b, 'hi');

    await as(a).post(`/api/users/${b.user._id}/block`).expect(200);

    const aProfile = await as(a).get('/api/auth/me').expect(200);
    expect(aProfile.body.data.user.followingCount).toBe(0);
    expect(aProfile.body.data.user.followersCount).toBe(0);

    await as(b).get(`/api/users/${a.user.username}`).expect(404);
    await as(a).get(`/api/users/${b.user.username}`).expect(404);
    await as(b).post(`/api/follows/${a.user._id}`).expect(404);
    await as(a).get(`/api/posts/${post._id}`).expect(404);
    await as(b).post('/api/conversations').send({ userId: a.user._id }).expect(404);

    const search = await as(b).get(`/api/search?q=${a.user.username}`).expect(200);
    expect(search.body.data).toHaveLength(0);

    await as(a).delete(`/api/users/${b.user._id}/block`).expect(200);
    await as(a).get(`/api/users/${b.user.username}`).expect(200);
  });
});

describe('follow counters', () => {
  it('stays consistent across repeated follow/unfollow', async () => {
    const a = await createUser();
    const b = await createUser();
    await Promise.all([as(a).post(`/api/follows/${b.user._id}`), as(a).post(`/api/follows/${b.user._id}`)]);
    await as(a).post(`/api/follows/${b.user._id}`).expect(200);
    let profile = await as(a).get(`/api/users/${b.user.username}`).expect(200);
    expect(profile.body.data.user.followersCount).toBe(1);
    await as(a).delete(`/api/follows/${b.user._id}`).expect(200);
    await as(a).delete(`/api/follows/${b.user._id}`).expect(200);
    profile = await as(a).get(`/api/users/${b.user.username}`).expect(200);
    expect(profile.body.data.user.followersCount).toBe(0);
    await as(a).post(`/api/follows/${a.user._id}`).expect(400);
  });
});
