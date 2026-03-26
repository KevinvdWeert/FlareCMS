const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
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
    throw new Error(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is 10 MB.`);
  }
};

/**
 * Uploads an image file to the local upload server at POST /api/upload-image.
 * Returns the relative web path, original filename, MIME type, and byte size.
 *
 * @param {File} file
 * @returns {Promise<{ path: string, fileName: string, mimeType: string, sizeBytes: number }>}
 */
export const uploadImageToServer = async (file) => {
  validateImageFile(file);

  const formData = new FormData();
  formData.append('file', file);

  let response;
  try {
    response = await fetch('/api/upload-image', {
      method: 'POST',
      body: formData,
    });
  } catch (_err) {
    throw new Error('Upload server is not reachable. Start from repo root with `npm run dev` (or run `npm run server:dev` in a separate terminal).');
  }

  if (!response.ok) {
    const errJson = await response.json().catch(() => null);
    const errText = errJson ? '' : await response.text().catch(() => '');

    if (
      response.status === 500 &&
      /ECONNREFUSED|proxy|connect/i.test(errText)
    ) {
      throw new Error('Upload server is not running. Start from repo root with `npm run dev` (or run `npm run server:dev` in a separate terminal).');
    }

    // Vite proxy can return an empty/plain 500 when the upload server is down.
    if (response.status === 500 && !errJson && !String(errText || '').trim()) {
      throw new Error('Upload server is not running. Start from repo root with `npm run dev` (or run `npm run server:dev` in a separate terminal).');
    }

    throw new Error(errJson?.error || `Upload failed with status ${response.status}.`);
  }

  const payload = await response.json();
  if (!payload?.path) {
    throw new Error('Upload succeeded but server did not return a file path.');
  }

  return payload;
};

/**
 * Resolves an image reference to a browser-loadable URL.
 *
 * For this project mode, Firestore stores relative web paths (e.g. /images/foo.jpg)
 * or absolute URLs. Both are supported directly.
 */
export const getImageUrl = async (storagePath) => {
  return resolveMediaUrl(storagePath);
};
