import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { createLogger } from "./lib/logger";
import { ErrorMessages } from "./lib/errors";
import { ALLOWED_MIME_TYPES, MAX_ASSET_BYTES } from "./lib/validation";
import { writeActivityLog, requireStaff } from "./lib/db";

const db = admin.firestore();

/**
 * Callable: Register image metadata in Firestore after a client-side upload
 * to the local upload server.  The `path` field must be a relative web path
 * such as `/images/hero-123.jpg`.
 */
export const registerMediaAsset = functions.https.onCall(async (data, context) => {
  const log = createLogger();
  await requireStaff(context);
  const uid = context.auth!.uid;

  const { path, fileName, mimeType, sizeBytes, tags = [] } = (data as {
    path?: string;
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
    tags?: string[];
  }) || {};

  if (!path || typeof path !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "path is required.");
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

  const imageRef = db.collection("images").doc();
  await imageRef.set({
    path,
    fileName,
    mimeType,
    sizeBytes: sizeBytes || null,
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
    resourceType: "image",
    resourceId: imageRef.id,
    meta: { fileName, mimeType, sizeBytes },
  });

  log.info("Image registered", { imageId: imageRef.id, uid });
  return { success: true, id: imageRef.id };
});

/**
 * Callable: List images with pagination and optional filtering.
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

  const safeLimit = Math.min(pageSize, 100);

  let baseQuery: admin.firestore.Query = db.collection("images");
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
    const startDoc = await db.collection("images").doc(startAfterId).get();
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
 * Callable: Delete an image record from Firestore.
 * Note: the physical file in the local `images/` folder is NOT deleted by
 * this function (the upload server does not expose a delete endpoint).
 * Owner or admin can delete. Prevents deletion if image is in use.
 */
export const deleteMediaAsset = functions.https.onCall(async (data, context) => {
  const log = createLogger();
  const callerData = await requireStaff(context);
  const uid = context.auth!.uid;

  const { id } = (data as { id?: string }) || {};
  if (!id || typeof id !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Image id is required.");
  }

  const imageRef = db.collection("images").doc(id);
  const imageSnap = await imageRef.get();

  if (!imageSnap.exists) {
    throw new functions.https.HttpsError("not-found", ErrorMessages.NOT_FOUND);
  }

  const image = imageSnap.data()!;

  if (callerData.role === "editor" && image.ownerId !== uid) {
    throw new functions.https.HttpsError("permission-denied", ErrorMessages.FORBIDDEN);
  }

  if (Array.isArray(image.usedInPages) && image.usedInPages.length > 0) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      `Image is used in ${image.usedInPages.length} page(s). Detach it first.`
    );
  }

  await imageRef.delete();

  await writeActivityLog({
    actorId: uid,
    actorEmail: context.auth!.token?.email || null,
    action: "media_deleted",
    resourceType: "image",
    resourceId: id,
    meta: { fileName: image.fileName },
  });

  log.info("Image deleted", { imageId: id, uid });
  return { success: true };
});

/**
 * Callable: Attach an image to a page.
 */
export const attachAssetToPage = functions.https.onCall(async (data, context) => {
  await requireStaff(context);

  const { assetId, pageId } = (data as { assetId?: string; pageId?: string }) || {};
  if (!assetId || !pageId) {
    throw new functions.https.HttpsError("invalid-argument", "assetId and pageId are required.");
  }

  const imageRef = db.collection("images").doc(assetId);
  const imageSnap = await imageRef.get();
  if (!imageSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Image not found.");
  }

  await imageRef.update({
    usedInPages: admin.firestore.FieldValue.arrayUnion(pageId),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});

/**
 * Callable: Detach an image from a page.
 */
export const detachAssetFromPage = functions.https.onCall(async (data, context) => {
  await requireStaff(context);

  const { assetId, pageId } = (data as { assetId?: string; pageId?: string }) || {};
  if (!assetId || !pageId) {
    throw new functions.https.HttpsError("invalid-argument", "assetId and pageId are required.");
  }

  const imageRef = db.collection("images").doc(assetId);
  const imageSnap = await imageRef.get();
  if (!imageSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Image not found.");
  }

  await imageRef.update({
    usedInPages: admin.firestore.FieldValue.arrayRemove(pageId),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});
