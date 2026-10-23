import { Notification } from '../models/index.js';
import { BRIEF_USER_FIELDS } from '../models/User.js';
import { ok } from '../utils/respond.js';
import { cursorFilter, pageMeta } from '../utils/pagination.js';
import { hiddenUserIds } from '../services/relationshipService.js';
import { unreadNotificationCount } from '../services/notificationService.js';
import { emitToUser } from '../sockets/emitter.js';

export async function listNotifications(req, res) {
  const { cursor, limit } = req.valid.query;
  const hidden = await hiddenUserIds(req.user._id);
  const rows = await Notification.find({ recipient: req.user._id, actor: { $nin: hidden }, ...cursorFilter(cursor) })
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate('actor', BRIEF_USER_FIELDS)
    .populate('post', '_id media caption')
    .populate('comment', '_id body')
    .lean();
  const { items, meta } = pageMeta(rows, limit);
  return ok(res, items.filter((n) => n.actor), meta);
}

export async function unreadCount(req, res) {
  return ok(res, { unreadCount: await unreadNotificationCount(req.user._id) });
}

export async function markAllRead(req, res) {
  await Notification.updateMany({ recipient: req.user._id, read: false }, { $set: { read: true } });
  emitToUser(req.user._id, 'notification:count', { unreadCount: 0 });
  return ok(res, { unreadCount: 0 });
}

export async function markRead(req, res) {
  await Notification.updateOne({ _id: req.valid.params.id, recipient: req.user._id }, { $set: { read: true } });
  const count = await unreadNotificationCount(req.user._id);
  emitToUser(req.user._id, 'notification:count', { unreadCount: count });
  return ok(res, { unreadCount: count });
}
