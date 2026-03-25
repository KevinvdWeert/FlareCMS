import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { createLogger } from "./lib/logger";
import { ErrorMessages } from "./lib/errors";
import { ALLOWED_MIME_TYPES, MAX_ASSET_BYTES } from "./lib/validation";
import { writeActivityLog, requireStaff } from "./lib/db";

const db = admin.firestore();

/**
 * Callable: Register media asset metadata in Firestore after a client-side upload.
 * The client uploads directly to Firebase Storage, then calls this function to
 * persist metadata.
 */
export const registerMediaAsset = functions.https.onCall(async (data, context) => {
  const log = createLogger();
  await requireStaff(context);
  const uid = context.auth!.uid;

  const { storagePath, fileName, mimeType, sizeBytes, dimensions, tags = [] } = (data as {
    storagePath?: string;
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
    dimensions?: { width: number; height: number };
    tags?: string[];
  }) || {};

  if (!storagePath || typeof storagePath !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "storagePath is required.");
  }
  if (!fileName || typeof fileName !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "fileName is required.");
  }
  if (!mimeType || !(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `mimeType must be one of: ${ALLOWED_MIME_TYPES.join(", ")}`
    );
  }
  if (sizeBytes !== undefined && sizeBytes > MAX_ASSET_BYTES) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `File too large. Maximum allowed size is ${MAX_ASSET_BYTES / 1024 / 1024} MB.`
    );
  }

  const assetRef = db.collection("mediaAssets").doc();
  await assetRef.set({
    storagePath,
    fileName,
    mimeType,
    sizeBytes: sizeBytes || null,
    dimensions: dimensions || null,
    tags: Array.isArray(tags) ? tags : [],
    ownerId: uid,
    usedInPages: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await writeActivityLog({
    actorId: uid,
    actorEmail: context.auth!.token?.email || null,
    action: "media_uploaded",
    resourceType: "mediaAsset",
    resourceId: assetRef.id,
    meta: { fileName, mimeType, sizeBytes },
  });

  log.info("Media asset registered", { assetId: assetRef.id, uid });
  return { success: true, id: assetRef.id };
});

/**
 * Callable: List media assets with pagination and optional filtering.
 * Requires staff.
 */
export const listMediaAssets = functions.https.onCall(async (data, context) => {
  const log = createLogger();
  await requireStaff(context);

  const { pageSize = 20, startAfterId, mimeTypeFilter, ownerOnly = false } = (data as {
    pageSize?: number;
    startAfterId?: string;
    mimeTypeFilter?: string;
    ownerOnly?: boolean;
  }) || {};

  log.info("listMediaAssets called", { callerUid: context.auth!.uid });

  // Fetch one extra document to determine whether a next page exists.
  const safeLimit = Math.min(pageSize, 100);

  // Build base query with all applicable filters combined.
  let baseQuery: admin.firestore.Query = db.collection("mediaAssets");
  if (ownerOnly) {
    baseQuery = baseQuery.where("ownerId", "==", context.auth!.uid);
  }
  if (mimeTypeFilter) {
    baseQuery = baseQuery.where("mimeType", "==", mimeTypeFilter);
  }
  let q: admin.firestore.Query = baseQuery
    .orderBy("createdAt", "desc")
    .limit(safeLimit + 1);

  if (startAfterId) {
    const startDoc = await db.collection("mediaAssets").doc(startAfterId).get();
    if (startDoc.exists) {
      q = q.startAfter(startDoc);
    }
  }

  const snap = await q.get();
  const hasMore = snap.docs.length > safeLimit;
  const pageDocs = snap.docs.slice(0, safeLimit);
  const assets = pageDocs.map((d) => ({ id: d.id, ...d.data() }));

  return { assets, hasMore };
});

/**
 * Callable: Delete a media asset (metadata + storage object).
 * Owner or admin can delete. Prevents deletion if asset is in use.
 */
export const deleteMediaAsset = functions.https.onCall(async (data, context) => {
  const log = createLogger();
  const callerData = await requireStaff(context);
  const uid = context.auth!.uid;

  const { id } = (data as { id?: string }) || {};
  if (!id || typeof id !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Asset id is required.");
  }

  const assetRef = db.collection("mediaAssets").doc(id);
  const assetSnap = await assetRef.get();

  if (!assetSnap.exists) {
    throw new functions.https.HttpsError("not-found", ErrorMessages.NOT_FOUND);
  }

  const asset = assetSnap.data()!;

  // Only owner or admin can delete
  if (callerData.role === "editor" && asset.ownerId !== uid) {
    throw new functions.https.HttpsError("permission-denied", ErrorMessages.FORBIDDEN);
  }

  // Prevent deletion if asset is attached to pages
  if (Array.isArray(asset.usedInPages) && asset.usedInPages.length > 0) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      `Asset is used in ${asset.usedInPages.length} page(s). Detach it first.`
    );
  }

  // Delete from Storage
  try {
    const bucket = admin.storage().bucket();
    await bucket.file(asset.storagePath).delete();
  } catch (err) {
    // Log but don't block metadata cleanup if the file is already gone
    log.warn("Storage delete failed (file may not exist)", { assetId: id, error: String(err) });
  }

  await assetRef.delete();

  await writeActivityLog({
    actorId: uid,
    actorEmail: context.auth!.token?.email || null,
    action: "media_deleted",
    resourceType: "mediaAsset",
    resourceId: id,
    meta: { fileName: asset.fileName },
  });

  log.info("Media asset deleted", { assetId: id, uid });
  return { success: true };
});

/**
 * Callable: Attach a media asset to a page.
 */
export const attachAssetToPage = functions.https.onCall(async (data, context) => {
  await requireStaff(context);

  const { assetId, pageId } = (data as { assetId?: string; pageId?: string }) || {};
  if (!assetId || !pageId) {
    throw new functions.https.HttpsError("invalid-argument", "assetId and pageId are required.");
  }

  const assetRef = db.collection("mediaAssets").doc(assetId);
  const assetSnap = await assetRef.get();
  if (!assetSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Asset not found.");
  }

  await assetRef.update({
    usedInPages: admin.firestore.FieldValue.arrayUnion(pageId),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});

/**
 * Callable: Detach a media asset from a page.
 */
export const detachAssetFromPage = functions.https.onCall(async (data, context) => {
  await requireStaff(context);

  const { assetId, pageId } = (data as { assetId?: string; pageId?: string }) || {};
  if (!assetId || !pageId) {
    throw new functions.https.HttpsError("invalid-argument", "assetId and pageId are required.");
  }

  const assetRef = db.collection("mediaAssets").doc(assetId);
  const assetSnap = await assetRef.get();
  if (!assetSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Asset not found.");
  }

  await assetRef.update({
    usedInPages: admin.firestore.FieldValue.arrayRemove(pageId),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});
