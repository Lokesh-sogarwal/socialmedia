import mongoose from 'mongoose';
import { mediaSchema } from './Post.js';

const storySchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    media: { type: mediaSchema, required: true },
    caption: { type: String, default: '', maxlength: 200 },
    viewsCount: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

storySchema.index({ author: 1, expiresAt: 1 });
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const storyViewSchema = new mongoose.Schema(
  {
    story: { type: mongoose.Schema.Types.ObjectId, ref: 'Story', required: true },
    viewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

storyViewSchema.index({ story: 1, viewer: 1 }, { unique: true });
storyViewSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Story = mongoose.model('Story', storySchema);
export const StoryView = mongoose.model('StoryView', storyViewSchema);
