/**
 * Redis-backed rate limiter.
 *
 * Uses an atomic Lua script (INCR + PEXPIRE in a single Redis round-trip) for
 * per-key sliding-window counters that survive server restarts and are shared
 * across multiple API-server instances.
 *
 * The Redis client is the shared singleton from @workspace/queues so that all
 * Redis consumers (queues, rate limiting) share a single connection and
 * configuration path.
 *
 * Fallback: when REDIS_URL is not set (local dev / no Redis sidecar) the
 * functions delegate to the in-memory ratelimit.ts implementation so that
 * behaviour is preserved in all environments.
 *
 * Fail-open: Redis call failures are caught, logged with logger.error, and
 * treated as "not rate limited" so an outage never blocks legitimate traffic.
 */

import { getSharedRedisClient } from "@workspace/queues";
import { logger } from "./logger.js";
import {
  isRateLimited as inMemoryIsRateLimited,
  isCurrentlyBlocked as inMemoryIsCurrentlyBlocked,
} from "./ratelimit.js";

// ── Lua script: atomic INCR + conditional PEXPIRE ─────────────────────────────
// Executed as a single atomic operation by Redis (Lua scripts are single-threaded
// in Redis). Sets the TTL only on the first hit so the window anchors to the
// first request, matching the prior in-memory implementation.
const INCR_AND_EXPIRE_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return current
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function redisKey(key: string): string {
  return `rl:${key}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns true if the request should be blocked, and increments the counter.
 *
 * When Redis is configured: uses an atomic Lua script (INCR + PEXPIRE) so
 * there is no race between setting the counter and its expiry.
 *
 * When Redis is not configured: delegates to the in-memory implementation in
 * ratelimit.ts so local-dev environments still get rate limiting.
 *
 * Fails open (returns false) on Redis errors.
 *
 * @param key      Unique key (e.g. IP, or "ip:email")
 * @param maxHits  Maximum allowed hits within windowMs
 * @param windowMs Time window in milliseconds
 */
export async function isRateLimited(
  key: string,
  maxHits: number,
  windowMs: number,
): Promise<boolean> {
  const redis = getSharedRedisClient();
  if (!redis) {
    return inMemoryIsRateLimited(key, maxHits, windowMs);
  }

  try {
    const count = (await redis.eval(
      INCR_AND_EXPIRE_SCRIPT,
      1,
      redisKey(key),
      String(windowMs),
    )) as number;
    return count > maxHits;
  } catch (err) {
    logger.error({ err, key }, "[RateLimit] Redis error in isRateLimited — failing open");
    return false;
  }
}

/**
 * Returns true if the key is currently over the rate limit WITHOUT
 * incrementing the counter.  Use as a pre-check to skip expensive operations
 * (e.g. DB lookups) for callers already known to be rate-limited.
 *
 * Falls back to in-memory implementation when Redis is not configured.
 * Fails open on Redis errors.
 */
export async function isCurrentlyBlocked(
  key: string,
  maxHits: number,
  windowMs: number,
): Promise<boolean> {
  const redis = getSharedRedisClient();
  if (!redis) {
    return inMemoryIsCurrentlyBlocked(key, maxHits, windowMs);
  }

  try {
    const raw = await redis.get(redisKey(key));
    if (raw === null) return false;
    return Number(raw) > maxHits;
  } catch (err) {
    logger.error({ err, key }, "[RateLimit] Redis error in isCurrentlyBlocked — failing open");
    return false;
  }
}

/**
 * Returns the remaining TTL in milliseconds for a rate-limit key, or 0 if the
 * key does not exist.  Used by middleware that needs to populate a Retry-After
 * header.
 *
 * Returns 0 when Redis is unavailable (in-memory TTLs are not exposed).
 */
export async function getRateLimitTtlMs(key: string): Promise<number> {
  const redis = getSharedRedisClient();
  if (!redis) return 0;

  try {
    const ttlMs = await redis.pttl(redisKey(key));
    return ttlMs > 0 ? ttlMs : 0;
  } catch (err) {
    logger.error({ err, key }, "[RateLimit] Redis error in getRateLimitTtlMs — returning 0");
    return 0;
  }
}
