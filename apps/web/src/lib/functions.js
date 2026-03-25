/**
 * Firebase Cloud Functions callable wrappers for FlareCMS frontend.
 *
 * Each exported function wraps the corresponding Cloud Function callable,
 * providing a typed, consistent interface for the frontend components.
 */
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { app } from './firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  getDoc,
  getDocs,
  doc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { auth } from './firebase';

const functions = getFunctions(app);

const IS_LOCALHOST =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const SHOULD_BYPASS_CALLABLES_LOCALLY =
  import.meta.env.DEV &&
  IS_LOCALHOST &&
  import.meta.env.VITE_USE_EMULATORS !== 'true';

const shouldFallbackToFirestore = (err) => {
  const code = String(err?.code || '');
  const msg = String(err?.message || '').toLowerCase();
  return (
    code.includes('internal') ||
    code.includes('unavailable') ||
    msg.includes('cors') ||
    msg.includes('failed to fetch') ||
    msg.includes('network')
  );
};

const directGetDashboardStats = async () => {
  const safeCount = async (fetchCount, fallbackValue = 0) => {
    try {
      return await fetchCount();
    } catch (err) {
      const code = String(err?.code || '');
      if (code.includes('permission-denied') || code.includes('failed-precondition')) {
        return fallbackValue;
      }
      throw err;
    }
  };

  const [totalUsers, publishedPages, draftPages, totalAssets] = await Promise.all([
    safeCount(async () => (await getDocs(collection(db, 'users'))).size, null),
    safeCount(async () => (await getDocs(query(collection(db, 'pages'), where('status', '==', 'published')))).size),
    safeCount(async () => (await getDocs(query(collection(db, 'pages'), where('status', '==', 'draft')))).size),
    safeCount(async () => (await getDocs(collection(db, 'images'))).size),
  ]);

  return {
    totalUsers,
    publishedPages,
    draftPages,
    totalAssets,
  };
};

const directGetRecentActivity = async ({ limit: limitCount = 10 } = {}) => {
  try {
    const snap = await getDocs(
      query(collection(db, 'activityLog'), orderBy('createdAt', 'desc'), limit(limitCount))
    );
    return { entries: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
  } catch (err) {
    const code = String(err?.code || '');
    if (code.includes('permission-denied') || code.includes('failed-precondition')) {
      return { entries: [] };
    }
    throw err;
  }
};

const directListMediaAssets = async ({ pageSize = 20, startAfterId = null, mimeTypeFilter, ownerOnly = false } = {}) => {
  try {
    let q;
    const base = collection(db, 'mediaAssets');

    if (mimeTypeFilter) {
      q = query(base, where('mimeType', '==', mimeTypeFilter), orderBy('createdAt', 'desc'), limit(Math.min(pageSize, 100)));
    } else {
      q = query(base, orderBy('createdAt', 'desc'), limit(Math.min(pageSize, 100)));
    }

    if (startAfterId) {
      const cursor = await getDoc(doc(db, 'mediaAssets', startAfterId));
      if (cursor.exists()) {
        q = query(q, startAfter(cursor));
      }
    }

    let docs = (await getDocs(q)).docs;

    if (ownerOnly) {
      docs = docs.filter((d) => !!d.data().ownerId);
    }

    return {
      assets: docs.map((d) => ({ id: d.id, ...d.data() })),
      hasMore: docs.length === pageSize,
    };
  } catch (err) {
    const code = String(err?.code || '');
    if (code.includes('permission-denied') || code.includes('failed-precondition')) {
      return { assets: [], hasMore: false };
    }
    throw err;
  }
};

const directDeleteMediaAsset = async (id) => {
  await deleteDoc(doc(db, 'mediaAssets', id));
  return { success: true };
};

const directRegisterMediaAsset = async (metadata) => {
  const user = auth.currentUser;
  if (!user?.uid) {
    const err = new Error('Not authenticated');
    err.code = 'auth/unauthenticated';
    throw err;
  }

  const payload = {
    storagePath: metadata.storagePath,
    fileName: metadata.fileName,
    mimeType: metadata.mimeType,
    sizeBytes: metadata.sizeBytes ?? null,
    dimensions: metadata.dimensions ?? null,
    tags: Array.isArray(metadata.tags) ? metadata.tags : [],
    ownerId: user.uid,
    usedInPages: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, 'mediaAssets'), payload);
  return { success: true, id: ref.id };
};

// Connect to emulator in development
if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

// -----------------------------------------------------------------------
// Auth
// -----------------------------------------------------------------------

/** Refreshes the caller's Firebase Auth custom claims from Firestore role. */
export const callRefreshClaims = () =>
  httpsCallable(functions, 'refreshClaims')();

// -----------------------------------------------------------------------
// User Management
// -----------------------------------------------------------------------

/**
 * Sets a user's role. Admin only.
 * @param {string} targetUid
 * @param {'user'|'editor'|'admin'} role
 */
export const callSetUserRole = (targetUid, role) =>
  httpsCallable(functions, 'setUserRole')({ targetUid, role });

/**
 * Lists users with optional pagination.
 * @param {{ pageSize?: number, startAfterUid?: string }} opts
 */
export const callListUsers = (opts = {}) =>
  httpsCallable(functions, 'listUsers')(opts);

/**
 * Creates an invite for a new user. Admin only.
 * @param {string} email
 * @param {'user'|'editor'|'admin'} role
 */
export const callCreateInvite = (email, role = 'user') =>
  httpsCallable(functions, 'createInvite')({ email, role });

/**
 * Accepts an invite by token.
 * @param {string} token
 */
export const callAcceptInvite = (token) =>
  httpsCallable(functions, 'acceptInvite')({ token });

// -----------------------------------------------------------------------
// Content Management
// -----------------------------------------------------------------------

/**
 * Checks whether a slug is available.
 * @param {string} slug
 * @param {string|null} excludeId
 * @returns {Promise<{ taken: boolean, valid: boolean }>}
 */
export const callCheckSlug = (slug, excludeId = null) =>
  httpsCallable(functions, 'checkSlug')({ slug, excludeId });

/**
 * Creates a new page via Cloud Function (server-side validation + slug guard).
 */
export const callCreatePage = (pageData) =>
  httpsCallable(functions, 'createPage')(pageData);

/**
 * Updates an existing page via Cloud Function.
 */
export const callUpdatePage = (id, pageData) =>
  httpsCallable(functions, 'updatePage')({ id, ...pageData });

/**
 * Deletes a page via Cloud Function.
 */
export const callDeletePage = (id) =>
  httpsCallable(functions, 'deletePage')({ id });

/**
 * Publishes a page (sets status to published).
 */
export const callPublishPage = (id) =>
  httpsCallable(functions, 'publishPage')({ id });

/**
 * Unpublishes a page (sets status to draft).
 */
export const callUnpublishPage = (id) =>
  httpsCallable(functions, 'unpublishPage')({ id });

/**
 * Sets or clears the site's front page. Admin only.
 * @param {string|null} pageId - The page ID to set as front page, or null to clear.
 */
export const callSetFrontPage = (pageId) =>
  httpsCallable(functions, 'setFrontPage')({ pageId });

// -----------------------------------------------------------------------
// Media Management
// -----------------------------------------------------------------------

/**
 * Registers a media asset's metadata in Firestore after a client-side upload.
 * @param {{ storagePath: string, fileName: string, mimeType: string, sizeBytes?: number, dimensions?: object, tags?: string[] }} metadata
 */
export const callRegisterMediaAsset = (metadata) =>
  (SHOULD_BYPASS_CALLABLES_LOCALLY
    ? directRegisterMediaAsset(metadata).then((data) => ({ data }))
    : httpsCallable(functions, 'registerMediaAsset')(metadata)
  ).catch(async (err) => {
    if (!shouldFallbackToFirestore(err)) {
      throw err;
    }
    console.warn('Falling back to Firestore for registerMediaAsset:', err?.message || err);
    return { data: await directRegisterMediaAsset(metadata) };
  });

/**
 * Lists media assets with pagination.
 * @param {{ pageSize?: number, startAfterId?: string, mimeTypeFilter?: string, ownerOnly?: boolean }} opts
 */
export const callListMediaAssets = (opts = {}) =>
  (SHOULD_BYPASS_CALLABLES_LOCALLY
    ? directListMediaAssets(opts).then((data) => ({ data }))
    : httpsCallable(functions, 'listMediaAssets')(opts)
  ).catch(async (err) => {
    if (!shouldFallbackToFirestore(err)) {
      throw err;
    }
    console.warn('Falling back to Firestore for listMediaAssets:', err?.message || err);
    return { data: await directListMediaAssets(opts) };
  });

/**
 * Deletes a media asset (metadata + storage file).
 * @param {string} id
 */
export const callDeleteMediaAsset = (id) =>
  (SHOULD_BYPASS_CALLABLES_LOCALLY
    ? directDeleteMediaAsset(id).then((data) => ({ data }))
    : httpsCallable(functions, 'deleteMediaAsset')({ id })
  ).catch(async (err) => {
    if (!shouldFallbackToFirestore(err)) {
      throw err;
    }
    console.warn('Falling back to Firestore for deleteMediaAsset:', err?.message || err);
    return { data: await directDeleteMediaAsset(id) };
  });

/**
 * Attaches a media asset to a page.
 * @param {string} assetId
 * @param {string} pageId
 */
export const callAttachAssetToPage = (assetId, pageId) =>
  httpsCallable(functions, 'attachAssetToPage')({ assetId, pageId });

/**
 * Detaches a media asset from a page.
 * @param {string} assetId
 * @param {string} pageId
 */
export const callDetachAssetFromPage = (assetId, pageId) =>
  httpsCallable(functions, 'detachAssetFromPage')({ assetId, pageId });

// -----------------------------------------------------------------------
// Dashboard
// -----------------------------------------------------------------------

/**
 * Gets aggregate dashboard stats (cached for 5 minutes server-side).
 */
export const callGetDashboardStats = () =>
  (SHOULD_BYPASS_CALLABLES_LOCALLY
    ? directGetDashboardStats().then((data) => ({ data }))
    : httpsCallable(functions, 'getDashboardStats')()
  ).catch(async (err) => {
    if (!shouldFallbackToFirestore(err)) {
      throw err;
    }
    console.warn('Falling back to Firestore for getDashboardStats:', err?.message || err);
    return { data: await directGetDashboardStats() };
  });

/**
 * Gets recent activity feed.
 * @param {{ limit?: number }} opts
 */
export const callGetRecentActivity = (opts = {}) =>
  (SHOULD_BYPASS_CALLABLES_LOCALLY
    ? directGetRecentActivity(opts).then((data) => ({ data }))
    : httpsCallable(functions, 'getRecentActivity')(opts)
  ).catch(async (err) => {
    if (!shouldFallbackToFirestore(err)) {
      throw err;
    }
    console.warn('Falling back to Firestore for getRecentActivity:', err?.message || err);
    return { data: await directGetRecentActivity(opts) };
  });

/**
 * Gets traffic summary placeholder.
 */
export const callGetTrafficSummary = () =>
  httpsCallable(functions, 'getTrafficSummary')();
