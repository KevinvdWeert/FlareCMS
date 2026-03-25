const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

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

  const response = await fetch('/api/upload-image', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Upload failed with status ${response.status}.`);
  }

  return response.json();
};
