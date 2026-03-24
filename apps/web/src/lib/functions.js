/**
 * Firebase Cloud Functions callable wrappers for FlareCMS frontend.
 *
 * Each exported function wraps the corresponding Cloud Function callable,
 * providing a typed, consistent interface for the frontend components.
 */
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { app } from './firebase';

const functions = getFunctions(app);

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

// -----------------------------------------------------------------------
// Media Management
// -----------------------------------------------------------------------

/**
 * Registers a media asset's metadata in Firestore after a client-side upload.
 * @param {{ storagePath: string, fileName: string, mimeType: string, sizeBytes?: number, dimensions?: object, tags?: string[] }} metadata
 */
export const callRegisterMediaAsset = (metadata) =>
  httpsCallable(functions, 'registerMediaAsset')(metadata);

/**
 * Lists media assets with pagination.
 * @param {{ pageSize?: number, startAfterId?: string, mimeTypeFilter?: string, ownerOnly?: boolean }} opts
 */
export const callListMediaAssets = (opts = {}) =>
  httpsCallable(functions, 'listMediaAssets')(opts);

/**
 * Deletes a media asset (metadata + storage file).
 * @param {string} id
 */
export const callDeleteMediaAsset = (id) =>
  httpsCallable(functions, 'deleteMediaAsset')({ id });

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
  httpsCallable(functions, 'getDashboardStats')();

/**
 * Gets recent activity feed.
 * @param {{ limit?: number }} opts
 */
export const callGetRecentActivity = (opts = {}) =>
  httpsCallable(functions, 'getRecentActivity')(opts);

/**
 * Gets traffic summary placeholder.
 */
export const callGetTrafficSummary = () =>
  httpsCallable(functions, 'getTrafficSummary')();
