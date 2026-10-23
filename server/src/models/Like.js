import mongoose from 'mongoose';

const likeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['post', 'comment'], required: true },
    target: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { timestamps: true },
);

likeSchema.index({ user: 1, targetType: 1, target: 1 }, { unique: true });
likeSchema.index({ target: 1, _id: -1 });

export const Like = mongoose.model('Like', likeSchema);
