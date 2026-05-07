import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";
import { isRateLimited, getRateLimitTtlMs } from "../lib/ratelimit-redis";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 5;

function getBucketKey(req: Request): string {
  if (req.internalAccountId) {
    return `brand_color:account:${req.internalAccountId}`;
  }
  const ip = req.ip ?? "unknown";
  return `brand_color:ip:${ip}`;
}

export async function brandColorRateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const key = getBucketKey(req);

  const blocked = await isRateLimited(key, MAX_REQUESTS, WINDOW_MS);
  if (blocked) {
    const ttlMs = await getRateLimitTtlMs(key);
    const retryAfterSec = Math.max(1, Math.ceil(ttlMs / 1000));
    logger.warn({ key }, "[BrandColorExtract] Rate limit exceeded");
    res.setHeader("Retry-After", String(retryAfterSec));
    res.status(429).json({
      error: `Too many color extraction requests. Please wait ${retryAfterSec} second${retryAfterSec !== 1 ? "s" : ""} before trying again.`,
    });
    return;
  }

  next();
}
