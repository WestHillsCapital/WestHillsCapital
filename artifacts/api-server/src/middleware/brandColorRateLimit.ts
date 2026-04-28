import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 5;

interface BucketEntry {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, BucketEntry>();

function evictStaleEntries(): void {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now - entry.windowStart >= WINDOW_MS) {
      buckets.delete(key);
    }
  }
}

setInterval(evictStaleEntries, WINDOW_MS).unref();

function getBucketKey(req: Request): string {
  if (req.internalAccountId) {
    return `account:${req.internalAccountId}`;
  }
  const ip = req.ip ?? "unknown";
  return `ip:${ip}`;
}

export function brandColorRateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = getBucketKey(req);
  const now = Date.now();

  let entry = buckets.get(key);
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    entry = { count: 0, windowStart: now };
    buckets.set(key, entry);
  }

  entry.count += 1;

  if (entry.count > MAX_REQUESTS) {
    const retryAfterSec = Math.ceil((WINDOW_MS - (now - entry.windowStart)) / 1000);
    logger.warn({ key, count: entry.count }, "[BrandColorExtract] Rate limit exceeded");
    res.setHeader("Retry-After", String(retryAfterSec));
    res.status(429).json({
      error: `Too many color extraction requests. Please wait ${retryAfterSec} second${retryAfterSec !== 1 ? "s" : ""} before trying again.`,
    });
    return;
  }

  next();
}
