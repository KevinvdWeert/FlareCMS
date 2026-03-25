/**
 * Shared Firestore helpers used across Cloud Functions.
 */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { ErrorMessages } from "./errors";

const db = admin.firestore();

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

export interface ActivityLogEntry {
  actorId: string;
  actorEmail?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string;
  meta?: Record<string, unknown>;
}

/**
 * Writes a structured entry to the activityLog collection.
 */
export async function writeActivityLog(entry: ActivityLogEntry): Promise<void> {
  await db.collection("activityLog").add({
    ...entry,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

/**
 * Verifies that the caller is authenticated and has a staff role (admin or
 * editor). Returns the caller's Firestore user document data.
 *
 * Throws an HttpsError if the caller is unauthenticated or lacks permission.
 */
export async function requireStaff(
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
