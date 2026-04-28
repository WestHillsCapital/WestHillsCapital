import type { Request, Response, NextFunction } from "express";
import { getDb } from "../db";
import { logger } from "../lib/logger";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 5;

function getBucketKey(req: Request): string {
  if (req.internalAccountId) {
    return `account:${req.internalAccountId}`;
  }
  const ip = req.ip ?? "unknown";
  return `ip:${ip}`;
}

export async function brandColorRateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const key = getBucketKey(req);
  const now = Date.now();

  try {
    const db = getDb();

    const { rows } = await db.query<{ count: number; window_start: string }>(
      `INSERT INTO brand_color_rate_limit (key, count, window_start)
       VALUES ($1, 1, $2)
       ON CONFLICT (key) DO UPDATE SET
         count        = CASE
                          WHEN brand_color_rate_limit.window_start + $3 <= $2
                          THEN 1
                          ELSE brand_color_rate_limit.count + 1
                        END,
         window_start = CASE
                          WHEN brand_color_rate_limit.window_start + $3 <= $2
                          THEN $2
                          ELSE brand_color_rate_limit.window_start
                        END
       RETURNING count, window_start`,
      [key, now, WINDOW_MS],
    );

    const row = rows[0];
    const count = row.count;
    const windowStart = Number(row.window_start);

    if (count > MAX_REQUESTS) {
      const retryAfterSec = Math.ceil((WINDOW_MS - (now - windowStart)) / 1000);
      logger.warn({ key, count }, "[BrandColorExtract] Rate limit exceeded");
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({
        error: `Too many color extraction requests. Please wait ${retryAfterSec} second${retryAfterSec !== 1 ? "s" : ""} before trying again.`,
      });
      return;
    }

    next();
  } catch (err) {
    logger.error({ err }, "[BrandColorExtract] Rate limit DB error — allowing request");
    next();
  }
}
