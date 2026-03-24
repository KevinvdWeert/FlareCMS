import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { createLogger } from "./lib/logger";
import { ErrorMessages } from "./lib/errors";
import { validateRole, type Role } from "./lib/validation";

const db = admin.firestore();
const auth = admin.auth();

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

/**
 * Callable: Update a user's role.
 * Requires admin. Prevents removing the last admin.
 */
export const setUserRole = functions.https.onCall(async (data, context) => {
  const log = createLogger();

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", ErrorMessages.UNAUTHENTICATED);
  }

  // Verify caller is admin via Firestore (authoritative source)
  const callerDoc = await db.collection("users").doc(context.auth.uid).get();
  if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", ErrorMessages.FORBIDDEN);
  }

  const { targetUid, role } = data as { targetUid?: string; role?: string };

  if (!targetUid || typeof targetUid !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "targetUid is required.");
  }
  if (!role || !validateRole(role)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `role must be one of: user, editor, admin.`
    );
  }

  log.info("setUserRole called", {
    callerUid: context.auth.uid,
    targetUid,
    role,
  });

  // Last-admin safety guard
  if (role !== "admin") {
    const targetDoc = await db.collection("users").doc(targetUid).get();
    if (targetDoc.exists && targetDoc.data()?.role === "admin") {
      // Count remaining admins
      const adminsSnap = await db
        .collection("users")
        .where("role", "==", "admin")
        .get();
      if (adminsSnap.size <= 1) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          ErrorMessages.LAST_ADMIN
        );
      }
    }
  }

  // Apply role change in Firestore
  const targetRef = db.collection("users").doc(targetUid);
  await targetRef.update({
    role: role as Role,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Sync Auth custom claims
  await auth.setCustomUserClaims(targetUid, { role });

  // Audit log
  await writeActivityLog({
    actorId: context.auth.uid,
    actorEmail: context.auth.token?.email || null,
    action: "role_change",
    resourceType: "user",
    resourceId: targetUid,
    meta: { newRole: role },
  });

  log.info("Role updated and claims synced", { targetUid, role });
  return { success: true };
});

/**
 * Callable: List users with pagination.
 * Requires admin role.
 */
export const listUsers = functions.https.onCall(async (data, context) => {
  const log = createLogger();

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", ErrorMessages.UNAUTHENTICATED);
  }

  const callerDoc = await db.collection("users").doc(context.auth.uid).get();
  if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", ErrorMessages.FORBIDDEN);
  }

  const { pageSize = 20, startAfterUid } = (data as {
    pageSize?: number;
    startAfterUid?: string;
  }) || {};

  log.info("listUsers called", { callerUid: context.auth.uid, pageSize });

  let q = db
    .collection("users")
    .orderBy("createdAt", "desc")
    .limit(Math.min(pageSize, 100));

  if (startAfterUid) {
    const startDoc = await db.collection("users").doc(startAfterUid).get();
    if (startDoc.exists) {
      q = q.startAfter(startDoc);
    }
  }

  const snap = await q.get();
  const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return { users, hasMore: snap.docs.length === pageSize };
});

/**
 * Callable: Create an invite for a new user.
 * Requires admin.
 */
export const createInvite = functions.https.onCall(async (data, context) => {
  const log = createLogger();

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", ErrorMessages.UNAUTHENTICATED);
  }

  const callerDoc = await db.collection("users").doc(context.auth.uid).get();
  if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", ErrorMessages.FORBIDDEN);
  }

  const { email, role = "user" } = (data as { email?: string; role?: string }) || {};

  if (!email || typeof email !== "string" || !email.includes("@")) {
    throw new functions.https.HttpsError("invalid-argument", "A valid email is required.");
  }
  if (!validateRole(role)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid role.");
  }

  log.info("createInvite called", { callerUid: context.auth.uid, email, role });

  // Check for existing pending invite
  const existingSnap = await db
    .collection("invites")
    .where("email", "==", email.trim().toLowerCase())
    .where("status", "==", "pending")
    .get();

  if (!existingSnap.empty) {
    throw new functions.https.HttpsError(
      "already-exists",
      "A pending invite already exists for this email."
    );
  }

  // Generate a cryptographically random token
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const inviteRef = await db.collection("invites").add({
    email: email.trim().toLowerCase(),
    role: role as Role,
    token,
    status: "pending",
    createdBy: context.auth.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
  });

  await writeActivityLog({
    actorId: context.auth.uid,
    actorEmail: context.auth.token?.email || null,
    action: "invite_created",
    resourceType: "invite",
    resourceId: inviteRef.id,
    meta: { email, role },
  });

  return { success: true, inviteId: inviteRef.id };
});

/**
 * Callable: Accept an invite by token.
 * The user must already be authenticated (created via normal signup).
 */
export const acceptInvite = functions.https.onCall(async (data, context) => {
  const log = createLogger();

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", ErrorMessages.UNAUTHENTICATED);
  }

  const { token } = (data as { token?: string }) || {};
  if (!token || typeof token !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "token is required.");
  }

  log.info("acceptInvite called", { uid: context.auth.uid });

  const inviteSnap = await db
    .collection("invites")
    .where("token", "==", token)
    .where("status", "==", "pending")
    .limit(1)
    .get();

  if (inviteSnap.empty) {
    throw new functions.https.HttpsError("not-found", ErrorMessages.INVITE_USED);
  }

  const inviteDoc = inviteSnap.docs[0];
  const invite = inviteDoc.data();

  // Check expiry
  const expiresAt = invite.expiresAt?.toDate?.() as Date | undefined;
  if (expiresAt && expiresAt < new Date()) {
    await inviteDoc.ref.update({ status: "expired" });
    throw new functions.https.HttpsError("failed-precondition", "This invite has expired.");
  }

  // Check email matches
  const callerEmail = context.auth.token?.email?.toLowerCase();
  if (callerEmail && invite.email && callerEmail !== invite.email) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "This invite is for a different email address."
    );
  }

  // Apply role to user and mark invite as used
  const batch = db.batch();
  batch.update(db.collection("users").doc(context.auth.uid), {
    role: invite.role,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  batch.update(inviteDoc.ref, {
    status: "used",
    usedBy: context.auth.uid,
    usedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await batch.commit();

  // Sync claims
  await auth.setCustomUserClaims(context.auth.uid, { role: invite.role });

  await writeActivityLog({
    actorId: context.auth.uid,
    action: "invite_accepted",
    resourceType: "invite",
    resourceId: inviteDoc.id,
    meta: { role: invite.role },
  });

  return { success: true, role: invite.role };
});

/** Generates a URL-safe 32-character cryptographically secure random token. */
function generateToken(): string {
  const crypto = require("crypto") as typeof import("crypto");
  return crypto.randomBytes(24).toString("base64url").slice(0, 32);
}
