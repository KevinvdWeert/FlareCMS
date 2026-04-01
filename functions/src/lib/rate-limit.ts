/**
 * Simple in-memory rate limiter for Cloud Functions callables.
 *
 * Tracks call counts per UID within a sliding window. Resets automatically
 * when the window expires. This is suitable for a single Cloud Functions
 * instance; for multi-instance deployments, consider Firestore-backed limits.
 */
import * as functions from "firebase-functions";

interface RateEntry {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, RateEntry>();

// Periodically clean up stale entries to prevent memory leaks.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now - entry.windowStart > CLEANUP_INTERVAL_MS) {
      buckets.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

/**
 * Enforces a rate limit for a given caller + action combination.
 *
 * @param uid        The caller's UID (used as the rate key).
 * @param action     A label for the action being rate-limited (e.g. "createPage").
 * @param maxCalls   Maximum number of calls allowed within the window.
 * @param windowMs   Length of the sliding window in milliseconds.
 * @throws HttpsError with code "resource-exhausted" if the limit is exceeded.
 */
export function enforceRateLimit(
  uid: string,
  action: string,
  maxCalls: number,
  windowMs: number
): void {
  const key = `${uid}:${action}`;
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return;
  }

  entry.count += 1;
  if (entry.count > maxCalls) {
    throw new functions.https.HttpsError(
      "resource-exhausted",
      `Too many requests. Please wait before trying again.`
    );
  }
}
