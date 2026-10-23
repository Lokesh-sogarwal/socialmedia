import { Notification } from '../models/index.js';
import { BRIEF_USER_FIELDS } from '../models/User.js';
import { emitToUser } from '../sockets/emitter.js';
import { isBlockedEitherWay } from './relationshipService.js';
import { logger } from '../utils/logger.js';

function key({ recipient, actor, type, post = null, comment = null }) {
  return { recipient, actor, type, post, comment };
}

export async function unreadNotificationCount(userId) {
  return Notification.countDocuments({ recipient: userId, read: false });
}

/**
 * Creates (or refreshes) a notification. Repeated identical events collapse into
 * one document, so like/unlike/like does not spam the recipient.
 */
export async function notify(input) {
  const { recipient, actor } = input;
  if (String(recipient) === String(actor)) return null;
  try {
    if (await isBlockedEitherWay(recipient, actor)) return null;
    const k = key(input);
    await Notification.deleteOne(k);
    const doc = await Notification.create(k);
    const populated = await Notification.findById(doc._id)
      .populate('actor', BRIEF_USER_FIELDS)
      .populate('post', '_id media caption')
      .populate('comment', '_id body')
      .lean();
    emitToUser(recipient, 'notification:new', {
      notification: populated,
      unreadCount: await unreadNotificationCount(recipient),
    });
    return populated;
  } catch (err) {
    if (err?.code === 11000) return null; // concurrent duplicate — already notified
    logger.warn({ err }, 'Failed to create notification');
    return null;
  }
}

export async function retractNotification(input) {
  const { deletedCount } = await Notification.deleteOne(key(input));
  if (deletedCount) {
    emitToUser(input.recipient, 'notification:count', {
      unreadCount: await unreadNotificationCount(input.recipient),
    });
  }
}
