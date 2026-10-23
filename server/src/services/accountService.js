import {
  Block,
  Bookmark,
  Comment,
  Conversation,
  Follow,
  Like,
  Message,
  Notification,
  Post,
  Report,
  Session,
  Story,
  StoryView,
  Token,
  User,
} from '../models/index.js';
import { deleteCommentCascade, deletePostCascade } from './postService.js';
import { removeMedia } from './storage.js';

/**
 * Permanently removes an account and its data, repairing counters on other
 * users' content. Conversations (and their messages) are removed for both sides.
 */
export async function deleteAccount(userId) {
  const user = await User.findById(userId).lean();
  if (!user) return;

  await Session.deleteMany({ user: userId });
  await Token.deleteMany({ user: userId });

  for await (const post of Post.find({ author: userId }).lean().cursor()) await deletePostCascade(post);

  // Top-level comments first (removes their replies too), then any remaining replies.
  for await (const c of Comment.find({ author: userId, parent: null }).lean().cursor()) await deleteCommentCascade(c);
  for await (const c of Comment.find({ author: userId }).lean().cursor()) await deleteCommentCascade(c);

  const likes = await Like.find({ user: userId }).select('targetType target').lean();
  const decrement = (Model, type) => {
    const ids = likes.filter((l) => l.targetType === type).map((l) => l.target);
    return ids.length ? Model.updateMany({ _id: { $in: ids }, likesCount: { $gt: 0 } }, { $inc: { likesCount: -1 } }) : null;
  };
  await Promise.all([decrement(Post, 'post'), decrement(Comment, 'comment')]);
  await Like.deleteMany({ user: userId });

  const follows = await Follow.find({ $or: [{ follower: userId }, { following: userId }], status: 'accepted' }).lean();
  const followingIds = follows.filter((f) => String(f.follower) === String(userId)).map((f) => f.following);
  const followerIds = follows.filter((f) => String(f.following) === String(userId)).map((f) => f.follower);
  await Promise.all([
    User.updateMany({ _id: { $in: followingIds }, followersCount: { $gt: 0 } }, { $inc: { followersCount: -1 } }),
    User.updateMany({ _id: { $in: followerIds }, followingCount: { $gt: 0 } }, { $inc: { followingCount: -1 } }),
  ]);
  await Follow.deleteMany({ $or: [{ follower: userId }, { following: userId }] });

  const stories = await Story.find({ author: userId }).lean();
  await StoryView.deleteMany({ $or: [{ viewer: userId }, { story: { $in: stories.map((s) => s._id) } }] });
  await Story.deleteMany({ author: userId });
  await removeMedia(stories.map((s) => s.media));

  const convoIds = (await Conversation.find({ 'members.user': userId }).select('_id').lean()).map((c) => c._id);
  await Message.deleteMany({ conversation: { $in: convoIds } });
  await Conversation.deleteMany({ _id: { $in: convoIds } });

  await Promise.all([
    Bookmark.deleteMany({ user: userId }),
    Notification.deleteMany({ $or: [{ recipient: userId }, { actor: userId }] }),
    Block.deleteMany({ $or: [{ blocker: userId }, { blocked: userId }] }),
    Report.deleteMany({ reporter: userId }),
  ]);

  await User.deleteOne({ _id: userId });
  await removeMedia([user.avatar, user.cover]);
}
