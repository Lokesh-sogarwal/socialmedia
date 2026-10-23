import mongoose from 'mongoose';

export const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    key: { type: String, required: true },
    type: { type: String, enum: ['image', 'video'], required: true },
    mimeType: String,
    size: Number,
    width: Number,
    height: Number,
  },
  { _id: false },
);

const postSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    caption: { type: String, default: '', maxlength: 2200 },
    media: { type: [mediaSchema], default: [] },
    hasVideo: { type: Boolean, default: false },
    hashtags: { type: [String], default: [] },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Denormalised from the author's privacy setting so discovery queries can filter without joins.
    audience: { type: String, enum: ['public', 'followers'], default: 'public' },
    likesCount: { type: Number, default: 0, min: 0 },
    commentsCount: { type: Number, default: 0, min: 0 },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

postSchema.index({ author: 1, _id: -1 });
postSchema.index({ hashtags: 1, _id: -1 });
postSchema.index({ audience: 1, _id: -1 });
postSchema.index({ audience: 1, hasVideo: 1, _id: -1 });
postSchema.index({ caption: 'text' });

export const Post = mongoose.model('Post', postSchema);
