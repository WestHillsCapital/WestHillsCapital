/**
 * Simple in-memory rate limiter.
 * Resets on server restart — sufficient for single-instance Railway deployment.
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * Returns true if the request should be blocked.
 * @param key      Unique key (e.g. IP, or "ip:email")
 * @param maxHits  Maximum allowed hits within windowMs
 * @param windowMs Time window in milliseconds
 */
export function isRateLimited(
  key: string,
  maxHits: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return false;
  }

  entry.count += 1;
  if (entry.count > maxHits) return true;
  return false;
}

// Purge stale entries every 10 minutes to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  const MAX_WINDOW = 10 * 60 * 1000; // 10 min — largest window we use
  for (const [key, entry] of store.entries()) {
    if (now - entry.windowStart > MAX_WINDOW) store.delete(key);
  }
}, 10 * 60 * 1000);
