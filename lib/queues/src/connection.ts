import type { ConnectionOptions } from "bullmq";

/**
 * Returns a BullMQ-compatible Redis connection config from REDIS_URL.
 * Returns null when REDIS_URL is not set (queues disabled / dev mode).
 */
export function getRedisConnection(): ConnectionOptions | null {
  const url = process.env["REDIS_URL"];
  if (!url) return null;
  return { url };
}

export function isQueueEnabled(): boolean {
  return !!process.env["REDIS_URL"];
}
