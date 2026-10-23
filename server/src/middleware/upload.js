import os from 'node:os';
import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;

// Coarse first pass on the declared type; storage re-checks the real type from the file bytes.
const ACCEPTED = /^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|quicktime))$/;

function upload({ maxFiles, field, imagesOnly = false }) {
  return multer({
    storage: multer.diskStorage({ destination: os.tmpdir() }),
    limits: { fileSize: imagesOnly ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES, files: maxFiles, fields: 20, parts: maxFiles + 20 },
    fileFilter: (_req, file, cb) => {
      const ok = ACCEPTED.test(file.mimetype) && (!imagesOnly || file.mimetype.startsWith('image/'));
      cb(ok ? null : ApiError.badRequest(`Unsupported file type: ${file.mimetype}`), ok);
    },
  }).array(field, maxFiles);
}

export const postMediaUpload = upload({ field: 'media', maxFiles: 10 });
export const storyMediaUpload = upload({ field: 'media', maxFiles: 1 });
export const imageUpload = upload({ field: 'image', maxFiles: 1, imagesOnly: true });
