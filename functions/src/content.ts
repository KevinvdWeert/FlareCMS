import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { createLogger } from "./lib/logger";
import { ErrorMessages } from "./lib/errors";
import { validateSlug, validateTitle } from "./lib/validation";

const db = admin.firestore();

/**
 * Writes a structured entry to the activityLog collection.
 */
async function writeActivityLog(entry: {
  actorId: string;
  actorEmail?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  await db.collection("activityLog").add({
    ...entry,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/** Checks if the caller is staff (admin or editor). */
async function requireStaff(
  context: functions.https.CallableContext
): Promise<admin.firestore.DocumentData> {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", ErrorMessages.UNAUTHENTICATED);
  }
  const doc = await db.collection("users").doc(context.auth.uid).get();
  if (!doc.exists) {
    throw new functions.https.HttpsError("permission-denied", ErrorMessages.FORBIDDEN);
  }
  const data = doc.data()!;
  const role = data.role as string;
  if (role !== "admin" && role !== "editor") {
    throw new functions.https.HttpsError("permission-denied", ErrorMessages.FORBIDDEN);
  }
  return data;
}

/**
 * Callable: Check whether a slug is taken (case-insensitive, excludes self).
 */
export const checkSlug = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", ErrorMessages.UNAUTHENTICATED);
  }

  const { slug, excludeId } = (data as { slug?: string; excludeId?: string }) || {};
  if (!slug || !validateSlug(slug)) {
    return { taken: false, valid: false };
  }

  const q = db.collection("pages").where("slug", "==", slug.trim().toLowerCase());
  const snap = await q.get();
  const taken = snap.docs.some((d) => d.id !== excludeId);

  return { taken, valid: true };
});

/**
 * Callable: Create a new page.
 * Requires staff. Returns the new page ID.
 */
export const createPage = functions.https.onCall(async (data, context) => {
  const log = createLogger();
  const callerData = await requireStaff(context);
  const uid = context.auth!.uid;

  const { title, slug, blocks = [], status = "draft", featuredImage = null } = (data as {
    title?: string;
    slug?: string;
    blocks?: unknown[];
    status?: string;
    featuredImage?: unknown;
  }) || {};

  if (!title || !validateTitle(title)) {
    throw new functions.https.HttpsError("invalid-argument", "title must be at least 2 characters.");
  }
  const normalizedSlug = (slug || "").trim().toLowerCase();
  if (!validateSlug(normalizedSlug)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "slug must contain only lowercase letters, numbers, and hyphens."
    );
  }

  // Slug uniqueness check
  const slugSnap = await db.collection("pages").where("slug", "==", normalizedSlug).get();
  if (!slugSnap.empty) {
    throw new functions.https.HttpsError("already-exists", ErrorMessages.SLUG_TAKEN);
  }

  const finalStatus = status === "published" ? "published" : "draft";

  const pageRef = db.collection("pages").doc();
  const pageData = {
    title: title.trim(),
    slug: normalizedSlug,
    blocks: Array.isArray(blocks) ? blocks : [],
    status: finalStatus,
    featuredImage: featuredImage || null,
    createdBy: uid,
    updatedBy: uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    publishedAt: finalStatus === "published" ? admin.firestore.FieldValue.serverTimestamp() : null,
    version: 1,
  };

  await pageRef.set(pageData);

  await writeActivityLog({
    actorId: uid,
    actorEmail: context.auth!.token?.email || null,
    action: "page_created",
    resourceType: "page",
    resourceId: pageRef.id,
    meta: { title: title.trim(), slug: normalizedSlug, status: finalStatus },
  });

  log.info("Page created", { pageId: pageRef.id, uid, title });
  return { success: true, id: pageRef.id };
});

/**
 * Callable: Update an existing page.
 * Author or admin can update. Editors can update their own pages.
 */
export const updatePage = functions.https.onCall(async (data, context) => {
  const log = createLogger();
  const callerData = await requireStaff(context);
  const uid = context.auth!.uid;

  const { id, title, slug, blocks, status, featuredImage } = (data as {
    id?: string;
    title?: string;
    slug?: string;
    blocks?: unknown[];
    status?: string;
    featuredImage?: unknown;
  }) || {};

  if (!id || typeof id !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Page id is required.");
  }

  const pageRef = db.collection("pages").doc(id);
  const pageSnap = await pageRef.get();

  if (!pageSnap.exists) {
    throw new functions.https.HttpsError("not-found", ErrorMessages.NOT_FOUND);
  }

  const existing = pageSnap.data()!;

  // Editors can only update their own pages; admins can update any
  if (callerData.role === "editor" && existing.createdBy !== uid) {
    throw new functions.https.HttpsError("permission-denied", ErrorMessages.FORBIDDEN);
  }

  const updatePayload: Record<string, unknown> = {
    updatedBy: uid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    version: admin.firestore.FieldValue.increment(1),
  };

  if (title !== undefined) {
    if (!validateTitle(title)) {
      throw new functions.https.HttpsError("invalid-argument", "title must be at least 2 characters.");
    }
    updatePayload.title = title.trim();
  }

  if (slug !== undefined) {
    const normalizedSlug = slug.trim().toLowerCase();
    if (!validateSlug(normalizedSlug)) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid slug format.");
    }
    if (normalizedSlug !== existing.slug) {
      const slugSnap = await db.collection("pages").where("slug", "==", normalizedSlug).get();
      if (slugSnap.docs.some((d) => d.id !== id)) {
        throw new functions.https.HttpsError("already-exists", ErrorMessages.SLUG_TAKEN);
      }
    }
    updatePayload.slug = normalizedSlug;
  }

  if (blocks !== undefined) {
    updatePayload.blocks = Array.isArray(blocks) ? blocks : [];
  }
  if (status !== undefined) {
    const validStatus = status === "published" ? "published" : "draft";
    updatePayload.status = validStatus;
    if (validStatus === "published" && existing.status !== "published") {
      updatePayload.publishedAt = admin.firestore.FieldValue.serverTimestamp();
    }
  }
  if (featuredImage !== undefined) {
    updatePayload.featuredImage = featuredImage;
  }

  await pageRef.update(updatePayload);

  await writeActivityLog({
    actorId: uid,
    actorEmail: context.auth!.token?.email || null,
    action: "page_updated",
    resourceType: "page",
    resourceId: id,
    meta: { fields: Object.keys(updatePayload).filter((k) => k !== "updatedAt" && k !== "updatedBy" && k !== "version") },
  });

  log.info("Page updated", { pageId: id, uid });
  return { success: true };
});

/**
 * Callable: Delete a page.
 * Author or admin can delete.
 */
export const deletePage = functions.https.onCall(async (data, context) => {
  const log = createLogger();
  const callerData = await requireStaff(context);
  const uid = context.auth!.uid;

  const { id } = (data as { id?: string }) || {};
  if (!id || typeof id !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Page id is required.");
  }

  const pageRef = db.collection("pages").doc(id);
  const pageSnap = await pageRef.get();

  if (!pageSnap.exists) {
    throw new functions.https.HttpsError("not-found", ErrorMessages.NOT_FOUND);
  }

  const existing = pageSnap.data()!;

  if (callerData.role === "editor" && existing.createdBy !== uid) {
    throw new functions.https.HttpsError("permission-denied", ErrorMessages.FORBIDDEN);
  }

  await pageRef.delete();

  await writeActivityLog({
    actorId: uid,
    actorEmail: context.auth!.token?.email || null,
    action: "page_deleted",
    resourceType: "page",
    resourceId: id,
    meta: { title: existing.title, slug: existing.slug },
  });

  log.info("Page deleted", { pageId: id, uid });
  return { success: true };
});

/**
 * Callable: Publish a page (set status to published).
 */
export const publishPage = functions.https.onCall(async (data, context) => {
  const log = createLogger();
  const callerData = await requireStaff(context);
  const uid = context.auth!.uid;

  const { id } = (data as { id?: string }) || {};
  if (!id || typeof id !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Page id is required.");
  }

  const pageRef = db.collection("pages").doc(id);
  const pageSnap = await pageRef.get();

  if (!pageSnap.exists) {
    throw new functions.https.HttpsError("not-found", ErrorMessages.NOT_FOUND);
  }

  const existing = pageSnap.data()!;
  if (callerData.role === "editor" && existing.createdBy !== uid) {
    throw new functions.https.HttpsError("permission-denied", ErrorMessages.FORBIDDEN);
  }

  await pageRef.update({
    status: "published",
    publishedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: uid,
    version: admin.firestore.FieldValue.increment(1),
  });

  await writeActivityLog({
    actorId: uid,
    actorEmail: context.auth!.token?.email || null,
    action: "page_published",
    resourceType: "page",
    resourceId: id,
    meta: { title: existing.title },
  });

  log.info("Page published", { pageId: id, uid });
  return { success: true };
});

/**
 * Callable: Unpublish a page (set status to draft).
 */
export const unpublishPage = functions.https.onCall(async (data, context) => {
  const log = createLogger();
  const callerData = await requireStaff(context);
  const uid = context.auth!.uid;

  const { id } = (data as { id?: string }) || {};
  if (!id || typeof id !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Page id is required.");
  }

  const pageRef = db.collection("pages").doc(id);
  const pageSnap = await pageRef.get();

  if (!pageSnap.exists) {
    throw new functions.https.HttpsError("not-found", ErrorMessages.NOT_FOUND);
  }

  await pageRef.update({
    status: "draft",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: uid,
    version: admin.firestore.FieldValue.increment(1),
  });

  await writeActivityLog({
    actorId: uid,
    actorEmail: context.auth!.token?.email || null,
    action: "page_unpublished",
    resourceType: "page",
    resourceId: id,
    meta: {},
  });

  log.info("Page unpublished", { pageId: id, uid });
  return { success: true };
});

/**
 * Callable: Set or clear the site's front page. Admin only.
 * Pass pageId to set a published page as the front page, or null to clear it.
 */
export const setFrontPage = functions.https.onCall(async (data, context) => {
  const log = createLogger();
  const callerData = await requireStaff(context);
  const uid = context.auth!.uid;

  if (callerData.role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", ErrorMessages.FORBIDDEN);
  }

  const { pageId } = (data as { pageId?: string | null }) || {};

  if (pageId != null) {
    if (typeof pageId !== "string") {
      throw new functions.https.HttpsError("invalid-argument", "pageId must be a string or null.");
    }
    const pageSnap = await db.collection("pages").doc(pageId).get();
    if (!pageSnap.exists) {
      throw new functions.https.HttpsError("not-found", ErrorMessages.NOT_FOUND);
    }
    if (pageSnap.data()!.status !== "published") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Only a published page can be set as the front page."
      );
    }
  }

  await db.collection("settings").doc("general").set(
    {
      frontPageId: pageId ?? null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid,
    },
    { merge: true }
  );

  await writeActivityLog({
    actorId: uid,
    actorEmail: context.auth!.token?.email || null,
    action: "front_page_set",
    resourceType: "settings",
    resourceId: "general",
    meta: { pageId: pageId ?? null },
  });

  log.info("Front page updated", { pageId: pageId ?? null, uid });
  return { success: true };
});
