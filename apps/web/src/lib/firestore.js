import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
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

export const createPage = async (pageData, uid) => {
  const pagesRef = collection(db, 'pages');
  const newDocRef = doc(pagesRef);
  const data = {
    ...pageData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: uid,
    updatedBy: uid,
    blocks: [],
    status: 'draft',
    featuredImage: null
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
