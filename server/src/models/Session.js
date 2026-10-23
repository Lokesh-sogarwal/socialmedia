import mongoose from 'mongoose';

/**
 * One document per refresh-token family (i.e. per login). The current token is stored
 * as a hash; rotation swaps the hash. Presenting an already-rotated token revokes the family.
 */
const sessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    previousHashes: { type: [String], default: [] },
    userAgent: { type: String, maxlength: 300 },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ previousHashes: 1 });

export const Session = mongoose.model('Session', sessionSchema);
