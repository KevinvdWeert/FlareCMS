import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import { v4 as uuidv4 } from 'uuid';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
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
  const storageRef = ref(storage, storagePath);
  return await getDownloadURL(storageRef);
};
