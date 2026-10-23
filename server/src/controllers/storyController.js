import { Story, StoryView, User } from '../models/index.js';
import { BRIEF_USER_FIELDS } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { created, ok } from '../utils/respond.js';
import { cleanupTempFiles, removeMedia, storeUploads } from '../services/storage.js';
import { acceptedFollowingIds, canViewContent } from '../services/relationshipService.js';

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

export async function createStory(req, res) {
  const files = req.files || [];
  if (files.length !== 1) {
    await cleanupTempFiles(files);
    throw ApiError.badRequest('A story needs exactly one photo or video');
  }
  const [media] = await storeUploads(files, { folder: 'stories', maxDimension: 1440 });
  const story = await Story.create({
    author: req.user._id,
    media,
    caption: req.valid.body.caption,
    expiresAt: new Date(Date.now() + STORY_TTL_MS),
  });
  return created(res, story.toObject());
}

/** Story tray: people you follow (plus you) with active stories, unseen first. */
export async function storyFeed(req, res) {
  const me = req.user._id;
  const authors = [me, ...(await acceptedFollowingIds(me))];
  const stories = await Story.find({ author: { $in: authors }, expiresAt: { $gt: new Date() } })
    .sort({ _id: 1 })
    .select('_id author')
    .lean();
  if (!stories.length) return ok(res, []);
  const viewed = new Set(
    (await StoryView.find({ viewer: me, story: { $in: stories.map((s) => s._id) } }).select('story').lean()).map((v) =>
      String(v.story),
    ),
  );
  const groups = new Map();
  for (const s of stories) {
    const key = String(s.author);
    const g = groups.get(key) || { authorId: s.author, count: 0, hasUnseen: false, latestAt: s._id.getTimestamp() };
    g.count += 1;
    g.latestAt = s._id.getTimestamp();
    if (!viewed.has(String(s._id)) && key !== String(me)) g.hasUnseen = true;
    groups.set(key, g);
  }
  const users = await User.find({ _id: { $in: [...groups.values()].map((g) => g.authorId) } })
    .select(BRIEF_USER_FIELDS)
    .lean();
  const userById = new Map(users.map((u) => [String(u._id), u]));
  const tray = [...groups.values()]
    .filter((g) => userById.has(String(g.authorId)))
    .map((g) => ({ user: userById.get(String(g.authorId)), count: g.count, hasUnseen: g.hasUnseen, latestAt: g.latestAt, isMine: String(g.authorId) === String(me) }))
    .sort((a, b) => Number(b.isMine) - Number(a.isMine) || Number(b.hasUnseen) - Number(a.hasUnseen) || b.latestAt - a.latestAt);
  return ok(res, tray);
}

export async function userStories(req, res) {
  const author = await User.findById(req.valid.params.id).select(BRIEF_USER_FIELDS).lean();
  if (!author || !(await canViewContent(req.user._id, author))) throw ApiError.notFound('Stories not found');
  const stories = await Story.find({ author: author._id, expiresAt: { $gt: new Date() } }).sort({ _id: 1 }).lean();
  const viewed = new Set(
    (await StoryView.find({ viewer: req.user._id, story: { $in: stories.map((s) => s._id) } }).select('story').lean()).map(
      (v) => String(v.story),
    ),
  );
  const isMine = String(author._id) === String(req.user._id);
  return ok(res, {
    user: author,
    stories: stories.map(({ viewsCount, ...s }) => ({
      ...s,
      seen: viewed.has(String(s._id)),
      ...(isMine ? { viewsCount } : {}),
    })),
  });
}

export async function viewStory(req, res) {
  const story = await Story.findOne({ _id: req.valid.params.id, expiresAt: { $gt: new Date() } })
    .populate('author', '_id isPrivate')
    .lean();
  if (!story || !(await canViewContent(req.user._id, story.author))) throw ApiError.notFound('Story not found');
  if (String(story.author._id) !== String(req.user._id)) {
    const result = await StoryView.updateOne(
      { story: story._id, viewer: req.user._id },
      { $setOnInsert: { story: story._id, viewer: req.user._id, expiresAt: story.expiresAt } },
      { upsert: true },
    );
    if (result.upsertedCount) await Story.updateOne({ _id: story._id }, { $inc: { viewsCount: 1 } });
  }
  return ok(res, { seen: true });
}

export async function storyViewers(req, res) {
  const story = await Story.findById(req.valid.params.id).lean();
  if (!story || String(story.author) !== String(req.user._id)) throw ApiError.notFound('Story not found');
  const views = await StoryView.find({ story: story._id }).sort({ _id: -1 }).limit(200).populate('viewer', BRIEF_USER_FIELDS).lean();
  return ok(res, views.filter((v) => v.viewer).map((v) => ({ user: v.viewer, viewedAt: v.createdAt })));
}

export async function deleteStory(req, res) {
  const story = await Story.findOneAndDelete({ _id: req.valid.params.id, author: req.user._id }).lean();
  if (!story) throw ApiError.notFound('Story not found');
  await StoryView.deleteMany({ story: story._id });
  await removeMedia([story.media]);
  return ok(res, { deleted: true });
}
