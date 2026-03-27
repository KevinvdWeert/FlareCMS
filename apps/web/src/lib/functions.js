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
  writeBatch,
  setDoc,
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

const getTimestampMs = (value) => {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  if (typeof value?._seconds === 'number') return value._seconds * 1000;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
};

const getUserDisplayName = (userData = {}) => {
  const fullName = String(userData.fullName || '').trim();
  if (fullName) return fullName;

  const displayName = String(userData.displayName || '').trim();
  if (displayName) return displayName;

  const firstName = String(userData.firstName || '').trim();
  const lastName = String(userData.lastName || '').trim();
  const combined = `${firstName} ${lastName}`.trim();
  if (combined) return combined;

  const email = String(userData.email || '').trim();
  if (email) return email;

  return '';
};

const enrichActivityActors = async (entries = []) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    return entries;
  }

  let usersSnap;
  try {
    usersSnap = await getDocs(collection(db, 'users'));
  } catch (err) {
    const code = String(err?.code || '');
    if (code.includes('permission-denied') || code.includes('failed-precondition')) {
      return entries;
    }
    throw err;
  }

  const byId = new Map();
  const byEmail = new Map();
  usersSnap.docs.forEach((d) => {
    const data = d.data() || {};
    byId.set(d.id, data);
    const email = String(data.email || '').trim().toLowerCase();
    if (email) {
      byEmail.set(email, data);
    }
  });

  return entries.map((entry) => {
    const actorId = String(entry?.actorId || entry?.actorUid || '').trim();
    const actorEmail = String(entry?.actorEmail || '').trim();
    const actorEmailLower = actorEmail.toLowerCase();
    const actorUidFromEmail = !actorEmail.includes('@') ? actorEmail : '';

    const userData =
      byId.get(actorId) ||
      byId.get(actorUidFromEmail) ||
      byEmail.get(actorEmailLower) ||
      null;

    if (!userData) {
      return entry;
    }

    const actorName = getUserDisplayName(userData);
    return {
      ...entry,
      actorName: actorName || entry.actorName || '',
      actorEmail: String(userData.email || actorEmail || '').trim(),
      actorId: actorId || actorUidFromEmail || entry.actorId || '',
    };
  });
};

const directGetSyntheticRecentActivity = async ({ limit: limitCount = 10 } = {}) => {
  const safeDocs = async (q) => {
    try {
      return (await getDocs(q)).docs;
    } catch (err) {
      const code = String(err?.code || '');
      if (code.includes('permission-denied') || code.includes('failed-precondition')) {
        return [];
      }
      throw err;
    }
  };

  const [pageDocs, mediaDocs, userDocs] = await Promise.all([
    safeDocs(query(collection(db, 'pages'), orderBy('updatedAt', 'desc'), limit(Math.max(limitCount, 8)))),
    safeDocs(query(collection(db, 'mediaAssets'), orderBy('createdAt', 'desc'), limit(Math.max(limitCount, 8)))),
    safeDocs(query(collection(db, 'users'), orderBy('updatedAt', 'desc'), limit(Math.max(limitCount, 8)))),
  ]);

  const pageEntries = pageDocs.map((d) => {
    const data = d.data() || {};
    return {
      id: `page-${d.id}`,
      action: data.status === 'published' ? 'page_published' : 'page_updated',
      actorEmail: data.updatedByEmail || data.createdByEmail || data.updatedBy || data.createdBy || 'System',
      resourceType: 'page',
      createdAt: data.updatedAt || data.createdAt || null,
      meta: { title: data.title || data.slug || d.id },
    };
  });

  const mediaEntries = mediaDocs.map((d) => {
    const data = d.data() || {};
    return {
      id: `media-${d.id}`,
      action: 'media_uploaded',
      actorEmail: data.ownerEmail || data.ownerId || 'System',
      resourceType: 'media',
      createdAt: data.createdAt || data.updatedAt || null,
      meta: { title: data.fileName || d.id },
    };
  });

  const userEntries = userDocs.map((d) => {
    const data = d.data() || {};
    return {
      id: `user-${d.id}`,
      action: 'user_profile',
      actorEmail: data.email || d.id,
      resourceType: 'user',
      createdAt: data.updatedAt || data.createdAt || null,
      meta: { title: data.role || 'user' },
    };
  });

  const combined = [...pageEntries, ...mediaEntries, ...userEntries]
    .sort((a, b) => getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt))
    .slice(0, limitCount);

  return { entries: combined };
};

const directGetSettingsHistory = async (settingType, limitCount = 10) => {
  const safeLimit = Math.min(Math.max(Number(limitCount) || 10, 1), 50);
  try {
    const snap = await getDocs(
      query(
        collection(db, 'settingsHistory', settingType, 'versions'),
        orderBy('savedAt', 'desc'),
        limit(safeLimit)
      )
    );

    return {
      versions: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    };
  } catch (err) {
    const code = String(err?.code || '');
    if (code.includes('permission-denied') || code.includes('failed-precondition')) {
      return { versions: [] };
    }
    throw err;
  }
};

const directSaveGlobalSettings = async (settingType, settings, publishNow = true) => {
  const user = auth.currentUser;
  if (!user?.uid) {
    const err = new Error('Not authenticated');
    err.code = 'auth/unauthenticated';
    throw err;
  }

  let stagingToken;
  const payload = {
    ...(settings || {}),
    _updatedAt: serverTimestamp(),
    _updatedBy: user.uid,
  };

  if (publishNow) {
    payload._staging = false;
    payload._stagingToken = null;
    payload._published = true;
    payload._publishedAt = serverTimestamp();
  } else {
    stagingToken = Math.random().toString(36).slice(2) + Date.now().toString(36);
    payload._staging = true;
    payload._stagingToken = stagingToken;
    payload._published = false;
  }

  await setDoc(doc(db, 'settings', settingType), payload, { merge: true });

  // Best effort history write. Some environments lock this collection to server-only writes.
  try {
    await addDoc(collection(db, 'settingsHistory', settingType, 'versions'), {
      settings,
      savedAt: serverTimestamp(),
      savedBy: user.uid,
      savedByEmail: user.email || null,
      isPublished: !!publishNow,
    });
  } catch (err) {
    console.warn('Unable to write settings history in local bypass mode:', err?.message || err);
  }

  return { success: true, ...(stagingToken ? { stagingToken } : {}) };
};

const directRestoreSettingsVersion = async (settingType, versionId) => {
  const user = auth.currentUser;
  if (!user?.uid) {
    const err = new Error('Not authenticated');
    err.code = 'auth/unauthenticated';
    throw err;
  }

  const versionRef = doc(db, 'settingsHistory', settingType, 'versions', versionId);
  const versionSnap = await getDoc(versionRef);
  if (!versionSnap.exists()) {
    const err = new Error('Version not found or not accessible in local bypass mode.');
    err.code = 'not-found';
    throw err;
  }

  const versionData = versionSnap.data() || {};
  const restoredSettings = versionData.settings || {};

  await setDoc(doc(db, 'settings', settingType), {
    ...restoredSettings,
    _staging: false,
    _stagingToken: null,
    _published: true,
    _publishedAt: serverTimestamp(),
    _updatedAt: serverTimestamp(),
    _updatedBy: user.uid,
    _restoredFrom: versionId,
  }, { merge: true });

  return { success: true };
};

const directPublishStagingSettings = async (settingType, stagingToken) => {
  const user = auth.currentUser;
  if (!user?.uid) {
    const err = new Error('Not authenticated');
    err.code = 'auth/unauthenticated';
    throw err;
  }

  const settingsRef = doc(db, 'settings', settingType);
  const snap = await getDoc(settingsRef);
  if (!snap.exists()) {
    const err = new Error('Settings document not found.');
    err.code = 'not-found';
    throw err;
  }

  const current = snap.data() || {};
  if (current._stagingToken !== stagingToken) {
    const err = new Error('Staging token mismatch.');
    err.code = 'permission-denied';
    throw err;
  }

  await setDoc(settingsRef, {
    _staging: false,
    _stagingToken: null,
    _published: true,
    _publishedAt: serverTimestamp(),
    _updatedAt: serverTimestamp(),
    _updatedBy: user.uid,
  }, { merge: true });

  return { success: true };
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

const directSetFrontPage = async (pageId) => {
  const user = auth.currentUser;
  if (!user?.uid) {
    const err = new Error('Not authenticated');
    err.code = 'auth/unauthenticated';
    throw err;
  }

  const pagesRef = collection(db, 'pages');
  const currentHomeSnap = await getDocs(query(pagesRef, where('isHomepage', '==', true)));

  const batch = writeBatch(db);
  currentHomeSnap.docs.forEach((d) => {
    batch.update(d.ref, {
      isHomepage: false,
      updatedAt: serverTimestamp(),
    });
  });

  if (pageId) {
    const targetRef = doc(db, 'pages', pageId);
    const targetSnap = await getDoc(targetRef);
    if (!targetSnap.exists()) {
      const err = new Error('Page not found.');
      err.code = 'not-found';
      throw err;
    }

    batch.update(targetRef, {
      isHomepage: true,
      updatedAt: serverTimestamp(),
    });
  }

  batch.set(doc(db, 'settings', 'general'), {
    frontPageId: pageId || null,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  await batch.commit();
  return { success: true, pageId: pageId || null };
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
  (SHOULD_BYPASS_CALLABLES_LOCALLY
    ? directSetFrontPage(pageId).then((data) => ({ data }))
    : httpsCallable(functions, 'setFrontPage')({ pageId })
  ).catch(async (err) => {
    if (!shouldFallbackToFirestore(err)) {
      throw err;
    }
    console.warn('Falling back to Firestore for setFrontPage:', err?.message || err);
    return { data: await directSetFrontPage(pageId) };
  });

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
  ).then(async (result) => {
    const entries = result?.data?.entries || [];
    if (entries.length > 0) {
      return { data: { ...result.data, entries: await enrichActivityActors(entries) } };
    }

    const synthetic = await directGetSyntheticRecentActivity(opts);
    if (synthetic.entries.length === 0) {
      return result;
    }
    return {
      data: {
        ...synthetic,
        entries: await enrichActivityActors(synthetic.entries),
      },
    };
  }).catch(async (err) => {
    if (!shouldFallbackToFirestore(err)) {
      throw err;
    }
    console.warn('Falling back to Firestore for getRecentActivity:', err?.message || err);
    const primary = await directGetRecentActivity(opts);
    if (primary.entries?.length) {
      return {
        data: {
          ...primary,
          entries: await enrichActivityActors(primary.entries),
        },
      };
    }
    const synthetic = await directGetSyntheticRecentActivity(opts);
    return {
      data: {
        ...synthetic,
        entries: await enrichActivityActors(synthetic.entries || []),
      },
    };
  });

/**
 * Gets traffic summary placeholder.
 */
export const callGetTrafficSummary = () =>
  httpsCallable(functions, 'getTrafficSummary')();

// -----------------------------------------------------------------------
// Settings Management
// -----------------------------------------------------------------------

/**
 * Saves global site settings. Admin only.
 * @param {string} settingType
 * @param {object} settings
 * @param {boolean} publishNow
 */
export const callSaveGlobalSettings = (settingType, settings, publishNow = true) =>
  SHOULD_BYPASS_CALLABLES_LOCALLY
    ? directSaveGlobalSettings(settingType, settings, publishNow).then((data) => ({ data }))
    : httpsCallable(functions, 'saveGlobalSettings')({ settingType, settings, publishNow });

/**
 * Restores a specific settings version. Admin only.
 * @param {string} settingType
 * @param {string} versionId
 */
export const callRestoreSettingsVersion = (settingType, versionId) =>
  SHOULD_BYPASS_CALLABLES_LOCALLY
    ? directRestoreSettingsVersion(settingType, versionId).then((data) => ({ data }))
    : httpsCallable(functions, 'restoreSettingsVersion')({ settingType, versionId });

/**
 * Returns version history for a settings type. Staff only.
 * @param {string} settingType
 * @param {number} limit
 */
export const callGetSettingsHistory = (settingType, limit = 10) =>
  (SHOULD_BYPASS_CALLABLES_LOCALLY
    ? directGetSettingsHistory(settingType, limit).then((data) => ({ data }))
    : httpsCallable(functions, 'getSettingsHistory')({ settingType, limit })
  ).catch(async (err) => {
    if (!shouldFallbackToFirestore(err)) {
      throw err;
    }
    console.warn('Falling back to Firestore for getSettingsHistory:', err?.message || err);
    return { data: await directGetSettingsHistory(settingType, limit) };
  });

/**
 * Publishes staging settings by token. Admin only.
 * @param {string} settingType
 * @param {string} stagingToken
 */
export const callPublishStagingSettings = (settingType, stagingToken) =>
  SHOULD_BYPASS_CALLABLES_LOCALLY
    ? directPublishStagingSettings(settingType, stagingToken).then((data) => ({ data }))
    : httpsCallable(functions, 'publishStagingSettings')({ settingType, stagingToken });
