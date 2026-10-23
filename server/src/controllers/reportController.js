import { Comment, Post, Report, User } from '../models/index.js';
import { BRIEF_USER_FIELDS } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { created, ok } from '../utils/respond.js';
import { cursorFilter, pageMeta } from '../utils/pagination.js';
import { deleteCommentCascade, deletePostCascade, loadVisiblePost } from '../services/postService.js';

const MODELS = { user: User, post: Post, comment: Comment };

export async function createReport(req, res) {
  const { targetType, target, reason, details } = req.valid.body;
  const doc = await MODELS[targetType].findById(target).lean();
  if (!doc) throw ApiError.notFound('The content you are reporting no longer exists');
  // You can only report what you can see.
  if (targetType === 'post') await loadVisiblePost(doc._id, req.user._id);
  if (targetType === 'comment') await loadVisiblePost(doc.post, req.user._id);
  if (targetType === 'user' && String(doc._id) === String(req.user._id)) throw ApiError.badRequest("You can't report yourself");
  try {
    await Report.create({ reporter: req.user._id, targetType, target, reason, details });
  } catch (err) {
    if (err?.code !== 11000) throw err; // already reported and still open
  }
  return created(res, { reported: true });
}

export async function listReports(req, res) {
  const { cursor, limit, status } = req.valid.query;
  const rows = await Report.find({ status, ...cursorFilter(cursor) })
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate('reporter', BRIEF_USER_FIELDS)
    .lean();
  const { items, meta } = pageMeta(rows, limit);

  // Attach a small preview of each target, batched per type.
  const byType = { user: [], post: [], comment: [] };
  for (const r of items) byType[r.targetType].push(r.target);
  const [users, posts, comments] = await Promise.all([
    User.find({ _id: { $in: byType.user } }).select(BRIEF_USER_FIELDS).lean(),
    Post.find({ _id: { $in: byType.post } }).select('_id caption media author').populate('author', BRIEF_USER_FIELDS).lean(),
    Comment.find({ _id: { $in: byType.comment } }).select('_id body post author').populate('author', BRIEF_USER_FIELDS).lean(),
  ]);
  const preview = new Map([...users, ...posts, ...comments].map((d) => [String(d._id), d]));
  return ok(res, items.map((r) => ({ ...r, preview: preview.get(String(r.target)) ?? null })), meta);
}

export async function resolveReport(req, res) {
  const report = await Report.findById(req.valid.params.id).lean();
  if (!report) throw ApiError.notFound('Report not found');
  const { action } = req.valid.body;
  if (action === 'remove_content') {
    if (report.targetType === 'user') throw ApiError.badRequest('Accounts cannot be removed from the report queue');
    const doc = await MODELS[report.targetType].findById(report.target).lean();
    if (doc && report.targetType === 'post') await deletePostCascade(doc);
    if (doc && report.targetType === 'comment') await deleteCommentCascade(doc);
  }
  const status = action === 'dismiss' ? 'dismissed' : 'actioned';
  // Resolve every open report about the same target together.
  await Report.updateMany(
    { targetType: report.targetType, target: report.target, status: 'open' },
    { $set: { status, resolvedBy: req.user._id, resolvedAt: new Date() } },
  );
  return ok(res, { status });
}
