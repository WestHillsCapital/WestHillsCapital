import { createHash } from "crypto";
import type { RequestHandler } from "express";
import { getDb } from "../db";
import { logger } from "../lib/logger";
import { isRateLimited, isCurrentlyBlocked } from "../lib/ratelimit";
import { isIpAllowed } from "../lib/cidr";

const APIKEY_FAIL_MAX = 10;
const APIKEY_FAIL_WINDOW_MS = 60 * 1000;

const API_KEY_PREFIX = "sk_live_";

/**
 * Hash a raw API key with SHA-256.
 * This is the value stored in the database — never the plaintext.
 */
export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Middleware for product routes that accepts an API key in lieu of a Clerk JWT.
 *
 * Expects:  Authorization: Bearer sk_live_<hex>
 *
 * On success sets req.internalAccountId and calls next().
 * On failure returns 401 — does NOT call next(), so callers that want to
 * try additional auth schemes must chain this differently.
 *
 * Use resolveApiKeyAccountId() if you need the raw lookup without an HTTP
 * response side-effect (e.g. inside requireProductAuth as a fallback).
 */
export async function resolveApiKeyAccountId(bearerToken: string): Promise<number | null> {
  if (!bearerToken.startsWith(API_KEY_PREFIX)) return null;

  const hash = hashApiKey(bearerToken);
  try {
    const result = await getDb().query<{ account_id: number }>(
      `SELECT account_id
         FROM account_api_keys
        WHERE key_hash = $1
          AND revoked_at IS NULL
        LIMIT 1`,
      [hash],
    );
    return result.rows[0]?.account_id ?? null;
  } catch (err) {
    logger.error({ err }, "[ApiKeyAuth] DB error resolving API key");
    return null;
  }
}

export const requireApiKeyAuth: RequestHandler = async (req, res, next) => {
  const ip = req.ip ?? "unknown";
  const rateLimitKey = `apikey_fail:${ip}`;

  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    if (isRateLimited(rateLimitKey, APIKEY_FAIL_MAX, APIKEY_FAIL_WINDOW_MS)) {
      return void res.status(429).json({ error: "Too many failed authentication attempts. Please wait before trying again." });
    }
    return void res.status(401).json({ error: "Authentication required. Provide an API key via Authorization: Bearer sk_live_…" });
  }

  const token = authHeader.slice(7).trim();
  if (!token.startsWith(API_KEY_PREFIX)) {
    if (isRateLimited(rateLimitKey, APIKEY_FAIL_MAX, APIKEY_FAIL_WINDOW_MS)) {
      return void res.status(429).json({ error: "Too many failed authentication attempts. Please wait before trying again." });
    }
    return void res.status(401).json({ error: "Invalid API key format. Keys must start with sk_live_." });
  }

  if (isCurrentlyBlocked(rateLimitKey, APIKEY_FAIL_MAX, APIKEY_FAIL_WINDOW_MS)) {
    return void res.status(429).json({ error: "Too many failed authentication attempts. Please wait before trying again." });
  }

  const accountId = await resolveApiKeyAccountId(token);
  if (accountId === null) {
    if (isRateLimited(rateLimitKey, APIKEY_FAIL_MAX, APIKEY_FAIL_WINDOW_MS)) {
      return void res.status(429).json({ error: "Too many failed authentication attempts. Please wait before trying again." });
    }
    return void res.status(401).json({ error: "Invalid or revoked API key." });
  }

  // ── IP allowlist check (enterprise feature) ──────────────────────────────
  // If the account has configured allowed_ip_ranges, the request IP must match
  // at least one entry. Empty array = no restriction (default for all plans).
  try {
    const { rows } = await getDb().query<{ allowed_ip_ranges: string[] }>(
      `SELECT allowed_ip_ranges FROM accounts WHERE id = $1`,
      [accountId],
    );
    const allowedRanges = rows[0]?.allowed_ip_ranges ?? [];
    if (!isIpAllowed(ip, allowedRanges)) {
      logger.warn({ accountId, ip }, "[ApiKeyAuth] Request blocked — IP not in allowlist");
      return void res.status(403).json({
        error: "Your IP address is not permitted to use this API key. Check your account's IP allowlist.",
        code: "IP_NOT_ALLOWED",
      });
    }
  } catch (err) {
    // DB failure checking allowlist — fail open to avoid blocking legitimate requests
    // during a DB hiccup, but log so ops can investigate.
    logger.error({ err, accountId }, "[ApiKeyAuth] Could not check IP allowlist — failing open");
  }

  req.internalAccountId = accountId;
  next();
};
