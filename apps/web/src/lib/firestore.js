import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';

// Users
export const getUserProfile = async (uid) => {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  return snap.exists() ? snap.data() : null;
};

export const observeUserProfile = (uid, onData, onError) => {
  const userRef = doc(db, 'users', uid);
  return onSnapshot(
    userRef,
    (snap) => {
      onData(snap.exists() ? snap.data() : null);
    },
    onError
  );
};

export const fetchUsers = async () => {
  const usersRef = collection(db, 'users');
  const snap = await getDocs(usersRef);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const updateUserRole = async (uid, role) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { role });
};

// Pages
export const getPages = async (onlyPublished = false) => {
  const pagesRef = collection(db, 'pages');
  let q = pagesRef;

  if (onlyPublished) {
    q = query(pagesRef, where('status', '==', 'published'));
  } else {
    q = query(pagesRef, orderBy('createdAt', 'desc'));
  }

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

/**
 * Fetches pages using cursor-based pagination.
 * @param {{ pageSize?: number, cursor?: import('firebase/firestore').QueryDocumentSnapshot|null, onlyPublished?: boolean }} options
 * @returns {Promise<{ items: Array<object>, nextCursor: import('firebase/firestore').QueryDocumentSnapshot|null, hasMore: boolean }>}
 */
export const getPagesPaginated = async ({ pageSize = 10, cursor = null, onlyPublished = false } = {}) => {
  const pagesRef = collection(db, 'pages');
  const constraints = [orderBy('createdAt', 'desc'), limit(pageSize + 1)];

  if (onlyPublished) {
    constraints.unshift(where('status', '==', 'published'));
  }
  if (cursor) {
    constraints.push(startAfter(cursor));
  }

  const q = query(pagesRef, ...constraints);
  const snap = await getDocs(q);
  const docs = snap.docs;
  const hasMore = docs.length > pageSize;
  const pageDocs = docs.slice(0, pageSize);
  const nextCursor = hasMore ? pageDocs[pageDocs.length - 1] : null;

  return {
    items: pageDocs.map((d) => ({ id: d.id, ...d.data() })),
    nextCursor,
    hasMore
  };
};

export const getPageById = async (id) => {
  const pageRef = doc(db, 'pages', id);
  const snap = await getDoc(pageRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const getPageBySlug = async (slug) => {
  const pagesRef = collection(db, 'pages');
  const q = query(pagesRef, where('slug', '==', slug), where('status', '==', 'published'));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const d = snap.docs[0];
    return { id: d.id, ...d.data() };
  }
  return null;
};

/**
 * Checks whether a slug is already used by another page.
 * @param {string} slug
 * @param {string|null} excludeId - page ID to exclude (for edit mode)
 * @returns {Promise<boolean>}
 */
export const isSlugTaken = async (slug, excludeId = null) => {
  const pagesRef = collection(db, 'pages');
  const q = query(pagesRef, where('slug', '==', slug));
  const snap = await getDocs(q);
  return snap.docs.some((d) => d.id !== excludeId);
};

export const createPage = async (pageData, uid) => {
  const pagesRef = collection(db, 'pages');
  const newDocRef = doc(pagesRef);
  const data = {
    // Safe defaults — overridden by caller-supplied pageData
    blocks: [],
    status: 'draft',
    featuredImage: null,
    ...pageData,
    // Server-controlled fields always win
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: uid,
    updatedBy: uid,
  };
  await setDoc(newDocRef, data);
  return newDocRef.id;
};

export const updatePage = async (id, pageData, uid) => {
  const pageRef = doc(db, 'pages', id);
  await updateDoc(pageRef, {
    ...pageData,
    updatedAt: serverTimestamp(),
    updatedBy: uid
  });
};

export const deletePage = async (id) => {
  const pageRef = doc(db, 'pages', id);
  await deleteDoc(pageRef);
};

// ---------------------------------------------------------------------------
// Images Collection
// ---------------------------------------------------------------------------

/**
 * Creates a new image metadata record in the `images` collection.
 *
 * @param {{ path: string, fileName: string, mimeType: string, sizeBytes: number, ownerId: string, tags?: string[] }} imageData
 * @returns {Promise<string>} The new document ID.
 */
export const createImageRecord = async (imageData) => {
  const imagesRef = collection(db, 'images');
  const newDocRef = doc(imagesRef);
  await setDoc(newDocRef, {
    path: imageData.path,
    fileName: imageData.fileName,
    mimeType: imageData.mimeType,
    sizeBytes: imageData.sizeBytes || null,
    ownerId: imageData.ownerId,
    tags: Array.isArray(imageData.tags) ? imageData.tags : [],
    usedInPages: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return newDocRef.id;
};

/**
 * Lists images with cursor-based pagination.
 *
 * @param {{ pageSize?: number, cursor?: import('firebase/firestore').QueryDocumentSnapshot|null }} opts
 * @returns {Promise<{ items: object[], nextCursor: import('firebase/firestore').QueryDocumentSnapshot|null, hasMore: boolean }>}
 */
export const getImagesPaginated = async ({ pageSize = 20, cursor = null } = {}) => {
  const imagesRef = collection(db, 'images');
  const constraints = [orderBy('createdAt', 'desc'), limit(pageSize + 1)];
  if (cursor) {
    constraints.push(startAfter(cursor));
  }
  const q = query(imagesRef, ...constraints);
  const snap = await getDocs(q);
  const docs = snap.docs;
  const hasMore = docs.length > pageSize;
  const pageDocs = docs.slice(0, pageSize);
  return {
    items: pageDocs.map((d) => ({ id: d.id, ...d.data() })),
    nextCursor: hasMore ? pageDocs[pageDocs.length - 1] : null,
    hasMore,
  };
};

/**
 * Deletes an image metadata record from the `images` collection.
 * Note: the physical file in the `images/` folder is NOT deleted by this call.
 *
 * @param {string} id
 */
export const deleteImageRecord = async (id) => {
  const imgRef = doc(db, 'images', id);
  await deleteDoc(imgRef);
};

/**
 * Fetches the general site settings document.
 * @returns {Promise<object|null>}
 */
export const getGeneralSettings = async () => {
  const settingsRef = doc(db, 'settings', 'general');
  const snap = await getDoc(settingsRef);
  return snap.exists() ? snap.data() : null;
};

/**
 * Returns the page that has isHomepage set to true, or null if none is set.
 * Falls back to settings/general.frontPageId for backward compatibility.
 * @returns {Promise<object|null>}
 */
export const getHomepagePage = async () => {
  const pagesRef = collection(db, 'pages');
  const q = query(pagesRef, where('isHomepage', '==', true), where('status', '==', 'published'));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const d = snap.docs[0];
    return { id: d.id, ...d.data() };
  }
  return null;
};

/**
 * Converts a Firestore Timestamp value to a JavaScript Date.
 *
 * Cloud Functions callables serialize Firestore Timestamps as plain objects
 * { seconds, nanoseconds } (or { _seconds, _nanoseconds }), not as Timestamp
 * instances. This helper handles all three cases:
 *   - A native Firestore Timestamp with a `.toDate()` method
 *   - A serialized plain object with `seconds` / `nanoseconds` fields
 *   - A serialized plain object with `_seconds` / `_nanoseconds` fields
 *   - Any other value passed directly to `new Date()` (e.g. ISO string, epoch ms)
 *
 * @param {unknown} ts - The timestamp value to convert.
 * @returns {Date} The corresponding JavaScript Date, or an Invalid Date if
 *   the input cannot be parsed.
 */
export const parseFirestoreTimestamp = (ts) => {
  if (!ts) return new Date(NaN);
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (ts.seconds !== undefined) return new Date(ts.seconds * 1000);
  if (ts._seconds !== undefined) return new Date(ts._seconds * 1000);
  return new Date(ts);
};
