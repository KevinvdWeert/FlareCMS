import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { createLogger } from "./lib/logger";
import { requireStaff } from "./lib/db";

const db = admin.firestore();

/** 5-minute cache TTL for dashboard stats. */
const STATS_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Callable: Get aggregate dashboard stats.
 * Returns counts for users, published pages, draft pages, and media assets.
 * Results are cached in a Firestore settings document for STATS_CACHE_TTL_MS.
 *
 * A Firestore transaction is used to check-and-write the cache atomically,
 * preventing a cache stampede where many concurrent callers all see a stale
 * cache and each independently fire the four aggregate queries.
 *
 * Requires staff.
 */
export const getDashboardStats = functions.https.onCall(async (_data, context) => {
  const log = createLogger();
  await requireStaff(context);

  const cacheRef = db.collection("settings").doc("dashboardStatsCache");

  // Fast path: serve from cache when fresh (no transaction needed for reads).
  const cacheSnap = await cacheRef.get();
  if (cacheSnap.exists) {
    const cached = cacheSnap.data()!;
    const cachedAt = cached.cachedAt?.toMillis?.() || 0;
    if (Date.now() - cachedAt < STATS_CACHE_TTL_MS) {
      log.info("Returning cached dashboard stats");
      return { ...cached.stats, fromCache: true };
    }
  }

  log.info("Computing fresh dashboard stats", { callerUid: context.auth!.uid });

  // Run all four aggregate queries in parallel.
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

  // Write the new cache value inside a transaction so that concurrent callers
  // that also passed the stale-cache check above don't overwrite each other
  // with slightly different timestamps — and only the first write wins.
  await db.runTransaction(async (txn) => {
    const fresh = await txn.get(cacheRef);
    const freshCachedAt = fresh.exists ? (fresh.data()!.cachedAt?.toMillis?.() || 0) : 0;
    // Only write if no other caller has already refreshed the cache since we
    // started computing.
    if (Date.now() - freshCachedAt >= STATS_CACHE_TTL_MS) {
      txn.set(cacheRef, {
        stats,
        cachedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

  return { ...stats, fromCache: false };
});

/**
 * Callable: Get recent activity feed.
 * Returns the last N activity log entries. Requires staff.
 */
export const getRecentActivity = functions.https.onCall(async (data, context) => {
  const log = createLogger();
  await requireStaff(context);

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
  await requireStaff(context);

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
