/**
 * Redis-backed rate limiter.
 *
 * Uses Redis INCR + PEXPIRE for atomic per-key counters that survive server
 * restarts and are shared across multiple API-server instances.
 *
 * Falls back gracefully: when REDIS_URL is not set, or when any Redis call
 * fails, both functions return false (fail-open) so that a Redis outage never
 * blocks legitimate traffic.
 */

import Redis from "ioredis";
import { logger } from "./logger.js";

// ── Lazy singleton ────────────────────────────────────────────────────────────

let _client: Redis | null = null;
let _initAttempted = false;

function getRedisClient(): Redis | null {
  if (_initAttempted) return _client;
  _initAttempted = true;

  const url = process.env["REDIS_URL"];
  if (!url) return null;

  try {
    _client = new Redis(url, {
      // Don't retry aggressively — rate limit operations are best-effort.
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: false,
    });

    _client.on("error", (err: Error) => {
      logger.error({ err }, "[RateLimit] Redis client error");
    });

    return _client;
  } catch (err) {
    logger.error({ err }, "[RateLimit] Failed to initialise Redis client — rate limiting will fail-open");
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns true if the request should be blocked, and increments the counter.
 *
 * Uses INCR + PEXPIRE: the TTL is only set on the first hit of each window so
 * the window anchors to the first request, matching the behaviour of the
 * previous in-memory implementation.
 *
 * Fails open (returns false) when Redis is unavailable.
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
  const redis = getRedisClient();
  if (!redis) return false;

  try {
    const count = await redis.incr(`rl:${key}`);
    if (count === 1) {
      // First hit — set the expiry for this window.
      await redis.pexpire(`rl:${key}`, windowMs);
    }
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
 * Fails open (returns false) when Redis is unavailable.
 */
export async function isCurrentlyBlocked(
  key: string,
  maxHits: number,
  _windowMs: number,
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;

  try {
    const raw = await redis.get(`rl:${key}`);
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
 * Fails open (returns 0) when Redis is unavailable.
 */
export async function getRateLimitTtlMs(key: string): Promise<number> {
  const redis = getRedisClient();
  if (!redis) return 0;

  try {
    const ttlMs = await redis.pttl(`rl:${key}`);
    return ttlMs > 0 ? ttlMs : 0;
  } catch (err) {
    logger.error({ err, key }, "[RateLimit] Redis error in getRateLimitTtlMs — returning 0");
    return 0;
  }
}
