import { Conversation, Follow, User } from '../models/index.js';
import { BRIEF_USER_FIELDS } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { isUserOnline } from '../sockets/emitter.js';
import { isBlockedEitherWay } from './relationshipService.js';

export function conversationKey(a, b) {
  return [String(a), String(b)].sort().join(':');
}

/** Membership check used by every conversation endpoint and socket event. */
export async function loadMemberConversation(conversationId, userId) {
  const convo = await Conversation.findOne({ _id: conversationId, 'members.user': userId }).lean();
  if (!convo) throw ApiError.notFound('Conversation not found');
  return convo;
}

export function otherMemberId(convo, userId) {
  return convo.members.find((m) => String(m.user) !== String(userId))?.user;
}

/**
 * You can start a conversation with anyone who hasn't blocked you (and you them),
 * provided their account is public or one of you follows the other.
 */
export async function assertCanStartConversation(me, other) {
  if (String(me) === String(other._id)) throw ApiError.badRequest("You can't message yourself");
  if (await isBlockedEitherWay(me, other._id)) throw ApiError.notFound('User not found');
  if (!other.isPrivate) return;
  const connected = await Follow.exists({
    status: 'accepted',
    $or: [
      { follower: me, following: other._id },
      { follower: other._id, following: me },
    ],
  });
  if (!connected) throw ApiError.forbidden('This account is private. Follow them to send a message');
}

export async function serializeConversations(convos, userId) {
  const otherIds = convos.map((c) => otherMemberId(c, userId));
  const users = await User.find({ _id: { $in: otherIds } }).select(BRIEF_USER_FIELDS + ' showActivityStatus').lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return convos.map((c) => {
    const mine = c.members.find((m) => String(m.user) === String(userId));
    const theirs = c.members.find((m) => String(m.user) !== String(userId));
    const other = byId.get(String(theirs?.user));
    const { showActivityStatus, ...otherPublic } = other || {};
    return {
      _id: c._id,
      other: other ? otherPublic : null,
      online: Boolean(other && showActivityStatus && isUserOnline(other._id)),
      unread: mine?.unread ?? 0,
      otherLastReadAt: theirs?.lastReadAt ?? null,
      lastMessage: c.lastMessage?.body ? c.lastMessage : null,
      lastActivityAt: c.lastActivityAt,
    };
  });
}
