/**
 * In-memory rate limiter — kept as a local-dev fallback only.
 *
 * Production code imports from ratelimit-redis.ts, which uses Redis INCR +
 * EXPIRE for cross-instance, restart-safe rate limiting. This module is no
 * longer used at runtime when REDIS_URL is configured.
 *
 * The 10-minute purge interval has been removed: Redis TTLs handle expiry
 * automatically, and this fallback is only active in environments without Redis
 * (typically local development).
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * Returns true if the request should be blocked, and increments the counter.
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

/**
 * Returns true if the key is currently over the rate limit WITHOUT incrementing
 * the counter. Use this as a pre-check to block expensive operations (e.g. DB
 * lookups) for IPs that are already known to be rate-limited.
 */
export function isCurrentlyBlocked(
  key: string,
  maxHits: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now - entry.windowStart >= windowMs) return false;
  return entry.count > maxHits;
}


