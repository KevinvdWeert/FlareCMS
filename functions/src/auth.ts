import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { createLogger } from "./lib/logger";

const db = admin.firestore();
const auth = admin.auth();

/**
 * Creates a Firestore user profile document when a new Firebase Auth user
 * is created (via signup form, Google OAuth, invite link, etc.).
 */
export const onUserCreated = functions.auth.user().onCreate(async (user) => {
  const log = createLogger();
  log.info("onUserCreated triggered", { uid: user.uid, email: user.email });

  try {
    const userRef = db.collection("users").doc(user.uid);
    const existing = await userRef.get();

    // Don't overwrite an existing profile (e.g. created by an invite flow).
    if (existing.exists) {
      log.info("User profile already exists, skipping creation", { uid: user.uid });
      return;
    }

    await userRef.set({
      email: user.email || null,
      fullName: user.displayName || null,
      displayName: user.displayName || null,
      photoURL: user.photoURL || null,
      role: "user",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
      profileComplete: !!(user.displayName && user.email),
    });

    log.info("Created Firestore user profile", { uid: user.uid });
  } catch (error) {
    log.error("Failed to create user profile", { uid: user.uid, error: String(error) });
    // Don't throw — auth trigger failures are not retried automatically in a useful way.
  }
});

/**
 * Cleans up Firestore when a Firebase Auth user is deleted.
 */
export const onUserDeleted = functions.auth.user().onDelete(async (user) => {
  const log = createLogger();
  log.info("onUserDeleted triggered", { uid: user.uid });

  try {
    const batch = db.batch();

    // Remove user profile doc
    batch.delete(db.collection("users").doc(user.uid));

    await batch.commit();
    log.info("Cleaned up user data", { uid: user.uid });
  } catch (error) {
    log.error("Failed to clean up user data", { uid: user.uid, error: String(error) });
  }
});

/**
 * Callable: Syncs custom claims from Firestore role.
 * Any authenticated user can call this on themselves to refresh claims after a role change.
 */
export const refreshClaims = functions.https.onCall(async (data, context) => {
  const log = createLogger();

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
  }

  const uid = context.auth.uid;
  log.info("refreshClaims called", { uid });

  try {
    const userDoc = await db.collection("users").doc(uid).get();
    const role = userDoc.exists ? (userDoc.data()?.role as string) || "user" : "user";

    await auth.setCustomUserClaims(uid, { role });
    log.info("Claims refreshed", { uid, role });

    return { success: true, role };
  } catch (error) {
    log.error("Failed to refresh claims", { uid, error: String(error) });
    throw new functions.https.HttpsError("internal", "Failed to refresh claims.");
  }
});
