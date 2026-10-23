import mongoose from 'mongoose';

/**
 * Cursor pagination over _id (descending). ObjectIds are roughly time-ordered,
 * which gives stable newest-first ordering without skip/limit drift.
 */
export function cursorFilter(cursor) {
  if (!cursor) return {};
  return { _id: { $lt: new mongoose.Types.ObjectId(cursor) } };
}

export function pageMeta(items, limit) {
  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  return {
    items: page,
    meta: { nextCursor: hasMore ? String(page[page.length - 1]._id) : null },
  };
}
