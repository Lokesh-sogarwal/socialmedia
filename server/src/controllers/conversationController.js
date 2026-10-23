import mongoose from 'mongoose';
import { Conversation, Message, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { created, ok } from '../utils/respond.js';
import { cursorFilter, pageMeta } from '../utils/pagination.js';
import { emitToUser } from '../sockets/emitter.js';
import { isBlockedEitherWay } from '../services/relationshipService.js';
import {
  assertCanStartConversation,
  conversationKey,
  loadMemberConversation,
  otherMemberId,
  serializeConversations,
} from '../services/messagingService.js';

export async function listConversations(req, res) {
  const { before, limit } = req.valid.query;
  const filter = { 'members.user': req.user._id, 'lastMessage.body': { $exists: true } };
  if (before) filter.lastActivityAt = { $lt: before };
  const convos = await Conversation.find(filter).sort({ lastActivityAt: -1 }).limit(limit + 1).lean();
  const hasMore = convos.length > limit;
  const page = convos.slice(0, limit);
  return ok(res, await serializeConversations(page, req.user._id), {
    nextCursor: hasMore ? page[page.length - 1].lastActivityAt.toISOString() : null,
  });
}

export async function unreadConversationCount(req, res) {
  const count = await Conversation.countDocuments({
    members: { $elemMatch: { user: req.user._id, unread: { $gt: 0 } } },
  });
  return ok(res, { unreadCount: count });
}

export async function startConversation(req, res) {
  const other = await User.findById(req.valid.body.userId).select('_id isPrivate').lean();
  if (!other) throw ApiError.notFound('User not found');
  await assertCanStartConversation(req.user._id, other);
  const key = conversationKey(req.user._id, other._id);
  const convo = await Conversation.findOneAndUpdate(
    { key },
    {
      $setOnInsert: {
        key,
        members: [{ user: req.user._id }, { user: other._id }],
        lastActivityAt: new Date(),
      },
    },
    { upsert: true, returnDocument: 'after' },
  ).lean();
  const [serialized] = await serializeConversations([convo], req.user._id);
  return ok(res, serialized);
}

export async function getConversation(req, res) {
  const convo = await loadMemberConversation(req.valid.params.id, req.user._id);
  const [serialized] = await serializeConversations([convo], req.user._id);
  serialized.blocked = await isBlockedEitherWay(req.user._id, otherMemberId(convo, req.user._id));
  return ok(res, serialized);
}

export async function listMessages(req, res) {
  const convo = await loadMemberConversation(req.valid.params.id, req.user._id);
  const { cursor, limit } = req.valid.query;
  const rows = await Message.find({ conversation: convo._id, ...cursorFilter(cursor) })
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();
  const { items, meta } = pageMeta(rows, limit);
  return ok(res, items, meta);
}

export async function sendMessage(req, res) {
  const me = req.user._id;
  const convo = await loadMemberConversation(req.valid.params.id, me);
  const otherId = otherMemberId(convo, me);
  if (await isBlockedEitherWay(me, otherId)) throw ApiError.forbidden("You can't message this account");
  const { body, clientId } = req.valid.body;

  let message;
  try {
    message = await Message.create({ conversation: convo._id, sender: me, body, clientId });
  } catch (err) {
    if (err?.code === 11000 && clientId) {
      // Retried send — return the original instead of duplicating it.
      return ok(res, await Message.findOne({ sender: me, clientId }).lean());
    }
    throw err;
  }
  const msg = message.toObject();
  await Conversation.updateOne(
    { _id: convo._id },
    {
      $set: {
        lastMessage: { body, sender: me, createdAt: msg.createdAt },
        lastActivityAt: msg.createdAt,
        'members.$[me].lastReadAt': msg.createdAt,
        'members.$[me].unread': 0,
      },
      $inc: { 'members.$[other].unread': 1 },
    },
    { arrayFilters: [{ 'me.user': me }, { 'other.user': otherId }] },
  );
  const fresh = await Conversation.findById(convo._id).lean();
  const [forOther] = await serializeConversations([fresh], otherId);
  const [forMe] = await serializeConversations([fresh], me);
  emitToUser(otherId, 'message:new', { message: msg, conversation: forOther });
  emitToUser(me, 'message:new', { message: msg, conversation: forMe });
  return created(res, msg);
}

export async function markConversationRead(req, res) {
  const me = req.user._id;
  const convo = await loadMemberConversation(req.valid.params.id, me);
  const now = new Date();
  await Conversation.updateOne(
    { _id: convo._id },
    { $set: { 'members.$[me].unread': 0, 'members.$[me].lastReadAt': now } },
    { arrayFilters: [{ 'me.user': new mongoose.Types.ObjectId(String(me)) }] },
  );
  emitToUser(otherMemberId(convo, me), 'conversation:read', { conversationId: convo._id, readerId: me, lastReadAt: now });
  emitToUser(me, 'conversation:read', { conversationId: convo._id, readerId: me, lastReadAt: now });
  return ok(res, { lastReadAt: now });
}
