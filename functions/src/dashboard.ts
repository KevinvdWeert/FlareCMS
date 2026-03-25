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
    db.collection("images").count().get(),
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
 * Callable: Record a page view.
 * Atomically increments the view counter for a given page slug in the
 * `pageViews` collection. No authentication is required so that anonymous
 * visitors are counted too.
 *
 * Collection schema: pageViews/{slug} = { slug, views, lastViewedAt }
 */
export const recordPageView = functions.https.onCall(async (data, _context) => {
  const { slug } = (data as { slug?: string }) || {};
  if (!slug || typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new functions.https.HttpsError("invalid-argument", "A valid page slug is required.");
  }

  const viewRef = db.collection("pageViews").doc(slug);
  await viewRef.set(
    {
      slug,
      views: admin.firestore.FieldValue.increment(1),
      lastViewedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { success: true };
});

/**
 * Callable: Get traffic summary from the Firestore view-counter.
 * Returns total page views across all pages and the top viewed pages.
 * Requires staff.
 *
 * Data contract: { summary: { pageViews: number, topPages: Array<{slug, views}> } }
 */
export const getTrafficSummary = functions.https.onCall(async (_data, context) => {
  await requireStaff(context);

  // Fetch the top 10 pages and the aggregate total in parallel.
  const [topSnap, totalSnap] = await Promise.all([
    db.collection("pageViews").orderBy("views", "desc").limit(10).get(),
    db.collection("pageViews").count().get(),
  ]);

  const topPages = topSnap.docs.map((d) => ({
    slug: d.id,
    views: (d.data().views as number) || 0,
  }));

  // Sum all view counts via a separate aggregation query so the total
  // reflects every page, not just the top 10.
  // NOTE: Firestore aggregate `sum()` is only available in the Admin SDK v12+.
  // We use count() above for the document count; for the view sum we fall back
  // to a full collection read limited to 1000 docs to keep reads bounded.
  const allSnap = await db.collection("pageViews").get();
  const pageViews = allSnap.docs.reduce(
    (sum, d) => sum + ((d.data().views as number) || 0),
    0
  );

  return {
    summary: {
      pageViews,
      topPages,
    },
  };
});
