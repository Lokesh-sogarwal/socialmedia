import mongoose from 'mongoose';

export const REPORT_REASONS = ['spam', 'harassment', 'hate', 'violence', 'nudity', 'misinformation', 'other'];

const reportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['user', 'post', 'comment'], required: true },
    target: { type: mongoose.Schema.Types.ObjectId, required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, default: '', maxlength: 500 },
    status: { type: String, enum: ['open', 'dismissed', 'actioned'], default: 'open' },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

reportSchema.index({ status: 1, _id: -1 });
// One open report per reporter per target.
reportSchema.index(
  { reporter: 1, targetType: 1, target: 1 },
  { unique: true, partialFilterExpression: { status: 'open' } },
);

export const Report = mongoose.model('Report', reportSchema);
