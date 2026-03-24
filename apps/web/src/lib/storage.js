import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import { v4 as uuidv4 } from 'uuid';

export const uploadFeaturedImage = async (pageId, file) => {
  const ext = file.name.split('.').pop();
  const filename = `${uuidv4()}.${ext}`;
  const storagePath = `pages/${pageId}/featured/${filename}`;
  const storageRef = ref(storage, storagePath);
  
  await uploadBytes(storageRef, file);
  return { storagePath, alt: file.name };
};

export const uploadBlockImage = async (pageId, file) => {
  const ext = file.name.split('.').pop();
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
