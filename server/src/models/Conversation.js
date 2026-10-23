import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    unread: { type: Number, default: 0, min: 0 },
    lastReadAt: { type: Date, default: null },
  },
  { _id: false },
);

const conversationSchema = new mongoose.Schema(
  {
    // Sorted "idA:idB" — guarantees one conversation per pair.
    key: { type: String, required: true, unique: true },
    members: { type: [memberSchema], validate: (v) => v.length === 2 },
    lastMessage: {
      body: String,
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      createdAt: Date,
    },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

conversationSchema.index({ 'members.user': 1, lastActivityAt: -1 });

export const Conversation = mongoose.model('Conversation', conversationSchema);
