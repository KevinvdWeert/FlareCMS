import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { ErrorMessages } from "./lib/errors";
import { writeActivityLog, requireStaff } from "./lib/db";

const db = admin.firestore();

const VALID_SETTING_TYPES = ["footer", "header", "homepage", "identity", "snippets", "seo", "contact"] as const;
type SettingType = (typeof VALID_SETTING_TYPES)[number];

function isValidSettingType(value: unknown): value is SettingType {
  return typeof value === "string" && (VALID_SETTING_TYPES as readonly string[]).includes(value);
}

/**
 * Saves global site settings. Admin only.
 * publishNow=true → live; publishNow=false → staging draft with token.
 */
export const saveGlobalSettings = functions.https.onCall(async (data, context) => {
  const callerData = await requireStaff(context);
  const uid = context.auth!.uid;

  if (callerData.role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", ErrorMessages.FORBIDDEN);
  }

  const { settingType, settings, publishNow = true } = (data as {
    settingType?: unknown;
    settings?: unknown;
    publishNow?: unknown;
  }) || {};

  if (!isValidSettingType(settingType)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `settingType must be one of: ${VALID_SETTING_TYPES.join(", ")}`
    );
  }

  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw new functions.https.HttpsError("invalid-argument", "settings must be a non-null object.");
  }

  const settingsRef = db.collection("settings").doc(settingType);
  const historyRef = db.collection("settingsHistory").doc(settingType).collection("versions");

  let stagingToken: string | undefined;
  let payload: Record<string, unknown>;

  if (publishNow) {
    payload = {
      ...(settings as Record<string, unknown>),
      _staging: admin.firestore.FieldValue.delete(),
      _stagingToken: admin.firestore.FieldValue.delete(),
      _published: true,
      _publishedAt: admin.firestore.FieldValue.serverTimestamp(),
      _updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      _updatedBy: uid,
    };
  } else {
    stagingToken = crypto.randomBytes(16).toString("hex");
    payload = {
      ...(settings as Record<string, unknown>),
      _staging: true,
      _stagingToken: stagingToken,
      _published: false,
      _updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      _updatedBy: uid,
    };
  }

  await settingsRef.set(payload, { merge: true });

  // Snapshot to history
  await historyRef.add({
    settings,
    savedAt: admin.firestore.FieldValue.serverTimestamp(),
    savedBy: uid,
    savedByEmail: context.auth!.token?.email || null,
    isPublished: !!publishNow,
  });

  await writeActivityLog({
    actorId: uid,
    actorEmail: context.auth!.token?.email || null,
    action: publishNow ? "settings_published" : "settings_saved_draft",
    resourceType: "settings",
    resourceId: settingType,
    meta: { settingType, publishNow: !!publishNow },
  });

  return { success: true, ...(stagingToken ? { stagingToken } : {}) };
});

/**
 * Restores a specific settings version. Admin only.
 */
export const restoreSettingsVersion = functions.https.onCall(async (data, context) => {
  const callerData = await requireStaff(context);
  const uid = context.auth!.uid;

  if (callerData.role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", ErrorMessages.FORBIDDEN);
  }

  const { settingType, versionId } = (data as { settingType?: unknown; versionId?: unknown }) || {};

  if (!isValidSettingType(settingType)) {
    throw new functions.https.HttpsError("invalid-argument", `Invalid settingType.`);
  }
  if (!versionId || typeof versionId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "versionId is required.");
  }

  const versionRef = db
    .collection("settingsHistory")
    .doc(settingType)
    .collection("versions")
    .doc(versionId);
  const versionSnap = await versionRef.get();

  if (!versionSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Version not found.");
  }

  const versionData = versionSnap.data()!;
  const restoredSettings = versionData.settings as Record<string, unknown>;

  const settingsRef = db.collection("settings").doc(settingType);
  const restorePayload = {
    ...restoredSettings,
    _staging: admin.firestore.FieldValue.delete(),
    _stagingToken: admin.firestore.FieldValue.delete(),
    _published: true,
    _publishedAt: admin.firestore.FieldValue.serverTimestamp(),
    _updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    _updatedBy: uid,
    _restoredFrom: versionId,
  };

  await settingsRef.set(restorePayload, { merge: true });

  // Snapshot the restore to history
  await db
    .collection("settingsHistory")
    .doc(settingType)
    .collection("versions")
    .add({
      settings: restoredSettings,
      savedAt: admin.firestore.FieldValue.serverTimestamp(),
      savedBy: uid,
      savedByEmail: context.auth!.token?.email || null,
      isPublished: true,
      restoredFrom: versionId,
    });

  await writeActivityLog({
    actorId: uid,
    actorEmail: context.auth!.token?.email || null,
    action: "settings_restored",
    resourceType: "settings",
    resourceId: settingType,
    meta: { settingType, versionId },
  });

  return { success: true };
});

/**
 * Returns the version history for a settings type. Staff only.
 */
export const getSettingsHistory = functions.https.onCall(async (data, context) => {
  await requireStaff(context);

  const { settingType, limit: limitCount = 10 } = (data as {
    settingType?: unknown;
    limit?: unknown;
  }) || {};

  if (!isValidSettingType(settingType)) {
    throw new functions.https.HttpsError("invalid-argument", `Invalid settingType.`);
  }

  const safeLimit = Math.min(Math.max(Number(limitCount) || 10, 1), 50);

  const versionsSnap = await db
    .collection("settingsHistory")
    .doc(settingType)
    .collection("versions")
    .orderBy("savedAt", "desc")
    .limit(safeLimit)
    .get();

  const versions = versionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return { versions };
});

/**
 * Publishes a staging draft by verifying the staging token. Admin only.
 */
export const publishStagingSettings = functions.https.onCall(async (data, context) => {
  const callerData = await requireStaff(context);
  const uid = context.auth!.uid;

  if (callerData.role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", ErrorMessages.FORBIDDEN);
  }

  const { settingType, stagingToken } = (data as {
    settingType?: unknown;
    stagingToken?: unknown;
  }) || {};

  if (!isValidSettingType(settingType)) {
    throw new functions.https.HttpsError("invalid-argument", `Invalid settingType.`);
  }
  if (!stagingToken || typeof stagingToken !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "stagingToken is required.");
  }

  const settingsRef = db.collection("settings").doc(settingType);
  const snap = await settingsRef.get();

  if (!snap.exists) {
    throw new functions.https.HttpsError("not-found", "Settings document not found.");
  }

  const currentData = snap.data()!;
  if (currentData._stagingToken !== stagingToken) {
    throw new functions.https.HttpsError("permission-denied", "Staging token mismatch.");
  }

  await settingsRef.set(
    {
      _staging: admin.firestore.FieldValue.delete(),
      _stagingToken: admin.firestore.FieldValue.delete(),
      _published: true,
      _publishedAt: admin.firestore.FieldValue.serverTimestamp(),
      _updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      _updatedBy: uid,
    },
    { merge: true }
  );

  await writeActivityLog({
    actorId: uid,
    actorEmail: context.auth!.token?.email || null,
    action: "settings_staging_published",
    resourceType: "settings",
    resourceId: settingType,
    meta: { settingType },
  });

  return { success: true };
});
