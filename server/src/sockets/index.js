import { Server } from 'socket.io';
import { z } from 'zod';
import { env } from '../config/env.js';
import { Conversation, User } from '../models/index.js';
import { userFromAccessToken } from '../middleware/auth.js';
import { verifyAccessToken } from '../services/tokenService.js';
import { isBlockedEitherWay } from '../services/relationshipService.js';
import { loadMemberConversation, otherMemberId } from '../services/messagingService.js';
import { logger } from '../utils/logger.js';
import { emitToUser, isUserOnline, setIo, userRoom } from './emitter.js';

const typingPayload = z.object({
  conversationId: z.string().regex(/^[a-f0-9]{24}$/i),
  isTyping: z.boolean(),
});

async function conversationPartnerIds(userId) {
  const convos = await Conversation.find({ 'members.user': userId })
    .sort({ lastActivityAt: -1 })
    .limit(200)
    .select('members.user')
    .lean();
  return convos.map((c) => otherMemberId(c, userId)).filter(Boolean);
}

async function broadcastPresence(userId, online) {
  const user = await User.findById(userId).select('showActivityStatus').lean();
  if (!user?.showActivityStatus) return;
  for (const partner of await conversationPartnerIds(userId)) {
    emitToUser(partner, 'presence', { userId: String(userId), online });
  }
}

export function attachSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientOrigins, credentials: true },
    maxHttpBufferSize: 16 * 1024,
    pingInterval: 25000,
  });

  // Every connection must present a valid access token; identity comes only from it.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const user = await userFromAccessToken(token);
      if (!user) return next(new Error('unauthorized'));
      socket.data.userId = String(user._id);
      socket.data.tokenExp = verifyAccessToken(token).exp;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const { userId } = socket.data;
    const wasOnline = isUserOnline(userId);
    socket.join(userRoom(userId));
    if (!wasOnline) broadcastPresence(userId, true).catch((err) => logger.warn({ err }, 'presence failed'));

    // Drop the socket when its token expires; the client reconnects with a fresh token.
    const msLeft = socket.data.tokenExp * 1000 - Date.now();
    const expiry = setTimeout(() => socket.disconnect(true), Math.max(msLeft, 0));

    let lastTyping = 0;
    socket.on('typing', async (raw) => {
      const parsed = typingPayload.safeParse(raw);
      if (!parsed.success) return;
      const now = Date.now();
      if (parsed.data.isTyping && now - lastTyping < 1000) return; // throttle
      lastTyping = now;
      try {
        const convo = await loadMemberConversation(parsed.data.conversationId, userId);
        const other = otherMemberId(convo, userId);
        if (await isBlockedEitherWay(userId, other)) return;
        emitToUser(other, 'typing', { conversationId: String(convo._id), userId, isTyping: parsed.data.isTyping });
      } catch {
        // Not a member — silently ignore.
      }
    });

    socket.on('disconnect', () => {
      clearTimeout(expiry);
      if (!isUserOnline(userId)) broadcastPresence(userId, false).catch(() => {});
    });
  });

  setIo(io);
  return io;
}
