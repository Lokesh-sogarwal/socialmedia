import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = [
  'follow',
  'follow_request',
  'follow_accept',
  'like_post',
  'like_comment',
  'comment',
  'reply',
  'mention',
];

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
    comment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

notificationSchema.index({ recipient: 1, _id: -1 });
notificationSchema.index({ recipient: 1, read: 1 });
// Dedupe key: repeating the same action (like → unlike → like) refreshes one notification.
notificationSchema.index({ recipient: 1, actor: 1, type: 1, post: 1, comment: 1 }, { unique: true });

export const Notification = mongoose.model('Notification', notificationSchema);
