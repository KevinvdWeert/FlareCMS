import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK once
if (!admin.apps.length) {
  admin.initializeApp();
}

// Auth triggers and callables
export {
  onUserCreated,
  onUserDeleted,
  refreshClaims,
} from "./auth";

// User management callables
export {
  setUserRole,
  listUsers,
  createInvite,
  acceptInvite,
} from "./users";

// Content management callables
export {
  checkSlug,
  createPage,
  updatePage,
  deletePage,
  publishPage,
  unpublishPage,
  setFrontPage,
} from "./content";

// Media management callables
export {
  registerMediaAsset,
  listMediaAssets,
  deleteMediaAsset,
  attachAssetToPage,
  detachAssetFromPage,
} from "./media";

// Dashboard callables
export {
  getDashboardStats,
  getRecentActivity,
  getTrafficSummary,
} from "./dashboard";

// Settings callables
export {
  saveGlobalSettings,
  restoreSettingsVersion,
  getSettingsHistory,
  publishStagingSettings,
} from "./settings";
