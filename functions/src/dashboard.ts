import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { createLogger } from "./lib/logger";
import { ErrorMessages } from "./lib/errors";

const db = admin.firestore();

/** 5-minute cache TTL for dashboard stats. */
const STATS_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Callable: Get aggregate dashboard stats.
 * Returns counts for users, published pages, draft pages, and media assets.
 * Results are cached in a Firestore settings document for STATS_CACHE_TTL_MS.
 * Requires staff.
 */
export const getDashboardStats = functions.https.onCall(async (_data, context) => {
  const log = createLogger();

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", ErrorMessages.UNAUTHENTICATED);
  }

  const callerDoc = await db.collection("users").doc(context.auth.uid).get();
  if (!callerDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", ErrorMessages.FORBIDDEN);
  }
  const role = callerDoc.data()?.role as string;
  if (role !== "admin" && role !== "editor") {
    throw new functions.https.HttpsError("permission-denied", ErrorMessages.FORBIDDEN);
  }

  // Check cache
  const cacheRef = db.collection("settings").doc("dashboardStatsCache");
  const cacheSnap = await cacheRef.get();
  if (cacheSnap.exists) {
    const cached = cacheSnap.data()!;
    const cachedAt = cached.cachedAt?.toMillis?.() || 0;
    if (Date.now() - cachedAt < STATS_CACHE_TTL_MS) {
      log.info("Returning cached dashboard stats");
      return { ...cached.stats, fromCache: true };
    }
  }

  log.info("Computing fresh dashboard stats", { callerUid: context.auth.uid });

  // Run aggregate queries in parallel
  const [usersSnap, publishedSnap, draftSnap, assetsSnap] = await Promise.all([
    db.collection("users").count().get(),
    db.collection("pages").where("status", "==", "published").count().get(),
    db.collection("pages").where("status", "==", "draft").count().get(),
    db.collection("mediaAssets").count().get(),
  ]);

  const stats = {
    totalUsers: usersSnap.data().count,
    publishedPages: publishedSnap.data().count,
    draftPages: draftSnap.data().count,
    totalAssets: assetsSnap.data().count,
    computedAt: new Date().toISOString(),
  };

  // Save to cache
  await cacheRef.set({
    stats,
    cachedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ...stats, fromCache: false };
});

/**
 * Callable: Get recent activity feed.
 * Returns the last N activity log entries. Requires staff.
 */
export const getRecentActivity = functions.https.onCall(async (data, context) => {
  const log = createLogger();

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", ErrorMessages.UNAUTHENTICATED);
  }

  const callerDoc = await db.collection("users").doc(context.auth.uid).get();
  if (!callerDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", ErrorMessages.FORBIDDEN);
  }
  const role = callerDoc.data()?.role as string;
  if (role !== "admin" && role !== "editor") {
    throw new functions.https.HttpsError("permission-denied", ErrorMessages.FORBIDDEN);
  }

  const { limit: limitCount = 20 } = (data as { limit?: number }) || {};

  const snap = await db
    .collection("activityLog")
    .orderBy("createdAt", "desc")
    .limit(Math.min(limitCount, 50))
    .get();

  const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  log.info("getRecentActivity returned", { count: entries.length });
  return { entries };
});

/**
 * Callable: Get traffic summary placeholder.
 * Returns a structured placeholder until real analytics are integrated.
 * Data contract: { summary: { pageViews: number, uniqueVisitors: number, topPages: Array<{slug, views}> } }
 */
export const getTrafficSummary = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", ErrorMessages.UNAUTHENTICATED);
  }

  const callerDoc = await db.collection("users").doc(context.auth.uid).get();
  if (!callerDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", ErrorMessages.FORBIDDEN);
  }
  const role = callerDoc.data()?.role as string;
  if (role !== "admin" && role !== "editor") {
    throw new functions.https.HttpsError("permission-denied", ErrorMessages.FORBIDDEN);
  }

  // TODO: Integrate Google Analytics Data API or a custom Firestore view-counter
  // to populate real traffic data. The data contract is:
  // { summary: { pageViews: number|null, uniqueVisitors: number|null, topPages: Array<{slug, views}> } }
  return {
    summary: {
      pageViews: null,
      uniqueVisitors: null,
      topPages: [],
    },
  };
});
