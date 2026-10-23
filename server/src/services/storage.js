import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { fileTypeFromFile } from 'file-type';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { IMAGE_MAX_BYTES } from '../middleware/upload.js';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

export const uploadRoot = path.resolve(env.UPLOAD_DIR);

async function sniff(file) {
  const detected = await fileTypeFromFile(file.path);
  const mime = detected?.mime;
  if (IMAGE_TYPES.has(mime)) {
    if (file.size > IMAGE_MAX_BYTES) throw new ApiError(413, 'UPLOAD_ERROR', 'Images must be 10 MB or smaller');
    return { kind: 'image', mime };
  }
  if (VIDEO_TYPES.has(mime)) return { kind: 'video', mime };
  throw ApiError.badRequest('File content does not match a supported image or video type');
}

/**
 * Images are re-encoded (auto-rotated, resized, metadata such as GPS stripped).
 * Videos are stored as uploaded after their real type is verified.
 */
async function prepare(file, { kind, mime }, { maxDimension }) {
  if (kind === 'image' && mime !== 'image/gif') {
    const { data, info } = await sharp(file.path)
      .rotate()
      .resize({ width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { buffer: data, ext: 'webp', mimeType: 'image/webp', width: info.width, height: info.height };
  }
  const buffer = await fs.readFile(file.path);
  const ext = { 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' }[mime];
  let dims = {};
  if (kind === 'image') {
    const meta = await sharp(buffer).metadata();
    dims = { width: meta.width, height: meta.height };
  }
  return { buffer, ext, mimeType: mime, ...dims };
}

const drivers = {
  local: {
    async put(key, buffer) {
      const target = path.join(uploadRoot, key);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, buffer);
      return `${env.PUBLIC_SERVER_URL}/uploads/${key}`;
    },
    async remove(key) {
      const target = path.join(uploadRoot, key);
      if (!target.startsWith(uploadRoot + path.sep)) return;
      await fs.rm(target, { force: true });
    },
  },
  cloudinary: {
    // Signed REST upload — needs CLOUDINARY_* credentials (see README).
    async put(key, buffer, mimeType) {
      const resource = mimeType.startsWith('video/') ? 'video' : 'image';
      const publicId = key.replace(/\.[^.]+$/, '');
      const timestamp = Math.floor(Date.now() / 1000);
      const toSign = `public_id=${publicId}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`;
      const signature = crypto.createHash('sha1').update(toSign).digest('hex');
      const form = new FormData();
      form.append('file', new Blob([buffer], { type: mimeType }));
      form.append('public_id', publicId);
      form.append('timestamp', String(timestamp));
      form.append('api_key', env.CLOUDINARY_API_KEY);
      form.append('signature', signature);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${resource}/upload`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        logger.error({ status: res.status }, 'Cloudinary upload failed');
        throw new ApiError(502, 'STORAGE_ERROR', 'Media storage is unavailable');
      }
      const body = await res.json();
      return body.secure_url;
    },
    async remove(key) {
      const publicId = key.replace(/\.[^.]+$/, '');
      const resource = /\.(mp4|webm|mov)$/.test(key) ? 'video' : 'image';
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = crypto
        .createHash('sha1')
        .update(`public_id=${publicId}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`)
        .digest('hex');
      const form = new FormData();
      form.append('public_id', publicId);
      form.append('timestamp', String(timestamp));
      form.append('api_key', env.CLOUDINARY_API_KEY);
      form.append('signature', signature);
      await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${resource}/destroy`, {
        method: 'POST',
        body: form,
      });
    },
  },
};

const driver = drivers[env.STORAGE_DRIVER];

export async function cleanupTempFiles(files = []) {
  await Promise.all(files.map((f) => fs.rm(f.path, { force: true })));
}

/** Validates and stores uploaded temp files. Always removes the temp files. */
export async function storeUploads(files, { folder, imagesOnly = false, maxDimension = 1600 } = {}) {
  const stored = [];
  try {
    const kinds = await Promise.all(files.map(sniff));
    if (imagesOnly && kinds.some((k) => k.kind !== 'image')) throw ApiError.badRequest('Only images are allowed here');
    for (let i = 0; i < files.length; i += 1) {
      const prepared = await prepare(files[i], kinds[i], { maxDimension });
      const key = `${folder}/${crypto.randomUUID()}.${prepared.ext}`;
      const url = await driver.put(key, prepared.buffer, prepared.mimeType);
      stored.push({
        url,
        key,
        type: kinds[i].kind,
        mimeType: prepared.mimeType,
        size: prepared.buffer.length,
        width: prepared.width,
        height: prepared.height,
      });
    }
    return stored;
  } catch (err) {
    await removeMedia(stored);
    throw err;
  } finally {
    await cleanupTempFiles(files);
  }
}

export async function removeMedia(items = []) {
  await Promise.all(
    items
      .filter((m) => m?.key)
      .map((m) =>
        driver.remove(m.key).catch((err) => logger.warn({ err, key: m.key }, 'Failed to remove media')),
      ),
  );
}
