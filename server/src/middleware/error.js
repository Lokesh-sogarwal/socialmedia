import mongoose from 'mongoose';
import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { cleanupTempFiles } from '../services/storage.js';

export function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.path} not found`));
}

export function errorHandler(err, req, res, _next) {
  let error = err;
  // Multer temp files are normally removed by storage; make sure failed requests don't leak them.
  if (Array.isArray(req.files)) cleanupTempFiles(req.files).catch(() => {});

  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message;
    error = new ApiError(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400, 'UPLOAD_ERROR', message);
  } else if (err instanceof mongoose.Error.CastError) {
    error = ApiError.badRequest(`Invalid ${err.path}`);
  } else if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    error = ApiError.badRequest(details[0]?.message || 'Validation failed', details);
  } else if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    error = ApiError.conflict(field ? `That ${field} is already taken` : 'Duplicate value', { field });
  } else if (err?.type === 'entity.too.large') {
    error = new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  } else if (err?.type === 'entity.parse.failed') {
    error = ApiError.badRequest('Malformed JSON body');
  }

  if (!(error instanceof ApiError)) {
    logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
    error = new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong');
  }

  res.status(error.status).json({
    success: false,
    error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
  });
}
