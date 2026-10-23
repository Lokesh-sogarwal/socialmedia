import mongoose from 'mongoose';

const mediaRefSchema = new mongoose.Schema(
  { url: String, key: String },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-z0-9_.]+$/,
    },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    displayName: { type: String, required: true, trim: true, maxlength: 50 },
    bio: { type: String, default: '', maxlength: 160 },
    website: { type: String, default: '', maxlength: 200 },
    location: { type: String, default: '', maxlength: 60 },
    avatar: { type: mediaRefSchema, default: null },
    cover: { type: mediaRefSchema, default: null },
    isPrivate: { type: Boolean, default: false },
    showActivityStatus: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },
    role: { type: String, enum: ['user', 'moderator', 'admin'], default: 'user' },
    followersCount: { type: Number, default: 0, min: 0 },
    followingCount: { type: Number, default: 0, min: 0 },
    postsCount: { type: Number, default: 0, min: 0 },
    passwordChangedAt: { type: Date },
  },
  { timestamps: true },
);

userSchema.index({ displayName: 'text', username: 'text' });

/** Fields that are safe to show to any viewer. */
export const PUBLIC_USER_FIELDS =
  '_id username displayName bio website location avatar cover isPrivate followersCount followingCount postsCount createdAt';
export const BRIEF_USER_FIELDS = '_id username displayName avatar isPrivate';

export const User = mongoose.model('User', userSchema);
