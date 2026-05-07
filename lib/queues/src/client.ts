/**
 * Shared Redis client — a lazy singleton backed by REDIS_URL.
 *
 * Centralises Redis connection creation so all consumers (queues, rate
 * limiting, etc.) share a single operational client and configuration path.
 *
 * Returns null when REDIS_URL is not set so callers can degrade gracefully in
 * local development or environments without Redis.
 */

import Redis from "ioredis";

let _client: Redis | null = null;
let _initAttempted = false;

/**
 * Returns the shared ioredis client, creating it on first call.
 * Returns null when REDIS_URL is not configured.
 */
export function getSharedRedisClient(): Redis | null {
  if (_initAttempted) return _client;
  _initAttempted = true;

  const url = process.env["REDIS_URL"];
  if (!url) return null;

  _client = new Redis(url, {
    // Don't block on ready-check — operations are best-effort for non-queue use.
    enableReadyCheck: false,
    // One retry per request keeps latency bounded for best-effort operations
    // like rate limiting; BullMQ workers manage their own retry logic.
    maxRetriesPerRequest: 1,
    lazyConnect: false,
  });

  return _client;
}
