import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import { v4 as uuidv4 } from 'uuid';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const MEDIA_BASE_URL = String(import.meta.env.VITE_MEDIA_BASE_URL || '').trim().replace(/\/$/, '');

const isAbsoluteUrl = (value) => /^https?:\/\//i.test(value);

export const resolveMediaUrl = (storagePath) => {
  if (!storagePath) return null;
  const raw = String(storagePath).trim();
  if (!raw) return null;

  if (isAbsoluteUrl(raw) || raw.startsWith('//')) {
    return raw;
  }

  if (raw.startsWith('/')) {
    return raw;
  }

  if (MEDIA_BASE_URL) {
    return `${MEDIA_BASE_URL}/${raw.replace(/^\/+/, '')}`;
  }

  return `/${raw.replace(/^\/+/, '')}`;
};

/**
 * Validates a file before upload.
 * @param {File} file
 * @throws {Error} if the file fails validation
 */
export const validateImageFile = (file) => {
  if (!file) {
    throw new Error('No file selected.');
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error(`Invalid file type "${file.type}". Only JPEG, PNG, GIF, WebP, and SVG images are allowed.`);
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is 5 MB.`);
  }
};

export const uploadFeaturedImage = async (pageId, file) => {
  validateImageFile(file);
  const ext = file.name.split('.').pop().toLowerCase();
  const filename = `${uuidv4()}.${ext}`;
  const storagePath = `pages/${pageId}/featured/${filename}`;
  const storageRef = ref(storage, storagePath);
  
  await uploadBytes(storageRef, file);
  return { storagePath, alt: file.name };
};

export const uploadBlockImage = async (pageId, file) => {
  validateImageFile(file);
  const ext = file.name.split('.').pop().toLowerCase();
  const filename = `${uuidv4()}.${ext}`;
  const storagePath = `pages/${pageId}/blocks/${filename}`;
  const storageRef = ref(storage, storagePath);
  
  await uploadBytes(storageRef, file);
  return { storagePath, alt: file.name };
};

export const getImageUrl = async (storagePath) => {
  if (!storagePath) return null;
  const raw = String(storagePath).trim();

  // Absolute and relative web paths are served directly by the web server/CDN.
  if (isAbsoluteUrl(raw) || raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../')) {
    return resolveMediaUrl(raw);
  }

  // Backward compatibility: try Firebase Storage for legacy paths.
  try {
    const storageRef = ref(storage, raw);
    return await getDownloadURL(storageRef);
  } catch {
    // If Storage is unavailable (no billing/bucket), treat the path as web-relative.
    return resolveMediaUrl(raw);
  }
};
