import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, maxlength: 2000 },
    clientId: { type: String, maxlength: 64 },
  },
  { timestamps: true },
);

messageSchema.index({ conversation: 1, _id: -1 });
// Lets clients retry a send safely after a dropped connection.
messageSchema.index(
  { sender: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } },
);

export const Message = mongoose.model('Message', messageSchema);
