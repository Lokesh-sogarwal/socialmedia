import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Replies are one level deep: a reply to a reply attaches to the top-level comment.
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
    body: { type: String, required: true, maxlength: 1000 },
    likesCount: { type: Number, default: 0, min: 0 },
    repliesCount: { type: Number, default: 0, min: 0 },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

commentSchema.index({ post: 1, parent: 1, _id: -1 });
commentSchema.index({ parent: 1, _id: 1 });

export const Comment = mongoose.model('Comment', commentSchema);
