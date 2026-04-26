import type { RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { getDb } from "../db";
import { logger } from "../lib/logger";
import { resolveApiKeyAccountId } from "./requireApiKeyAuth";
import { isRateLimited, isCurrentlyBlocked } from "../lib/ratelimit";

const APIKEY_FAIL_MAX = 10;
const APIKEY_FAIL_WINDOW_MS = 60 * 1000;

/**
 * Auth middleware for the DocuFill SaaS product routes.
 *
 * Accepts three auth methods (in order):
 *   1. req.internalAccountId already set — pass through (e.g. requireInternalAuth ran first)
 *   2. Clerk JWT — for tenants using the /app product portal
 *   3. API key (Authorization: Bearer sk_live_…) — for external integration partners
 *
 * Sets req.internalAccountId on success; returns 401 otherwise.
 */
const AUTH_DISABLED = !process.env["GOOGLE_CLIENT_ID"] && !process.env["CLERK_SECRET_KEY"];

export const requireProductAuth: RequestHandler = async (req, res, next) => {
  if (AUTH_DISABLED) {
    req.internalAccountId = req.internalAccountId ?? 1;
    return next();
  }

  if (req.internalAccountId !== undefined) {
    return next();
  }

  const authHeader = req.headers["authorization"];
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (bearerToken?.startsWith("sk_live_")) {
    const ip = req.ip ?? "unknown";
    const rateLimitKey = `apikey_fail:${ip}`;

    if (isCurrentlyBlocked(rateLimitKey, APIKEY_FAIL_MAX, APIKEY_FAIL_WINDOW_MS)) {
      return void res.status(429).json({ error: "Too many failed authentication attempts. Please wait before trying again." });
    }

    const accountId = await resolveApiKeyAccountId(bearerToken);
    if (accountId === null) {
      if (isRateLimited(rateLimitKey, APIKEY_FAIL_MAX, APIKEY_FAIL_WINDOW_MS)) {
        return void res.status(429).json({ error: "Too many failed authentication attempts. Please wait before trying again." });
      }
      return void res.status(401).json({ error: "Invalid or revoked API key." });
    }
    req.internalAccountId = accountId;
    return next();
  }

  const auth = getAuth(req);
  const clerkUserId = auth?.userId;

  if (!clerkUserId) {
    return void res.status(401).json({ error: "Authentication required." });
  }

  try {
    const result = await getDb().query<{ account_id: number }>(
      `SELECT account_id FROM account_users WHERE clerk_user_id = $1 LIMIT 1`,
      [clerkUserId],
    );

    if (!result.rows[0]) {
      return void res.status(401).json({
        error: "Account not found. Please complete sign-up.",
        code: "ACCOUNT_NOT_FOUND",
      });
    }

    req.internalAccountId = result.rows[0].account_id;
    next();
  } catch (err) {
    logger.error({ err }, "[ProductAuth] DB error resolving Clerk user");
    return void res.status(503).json({ error: "Auth service unavailable." });
  }
};
