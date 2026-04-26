import type { RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { getDb } from "../db";
import { logger } from "../lib/logger";

/**
 * Auth middleware for the DocuFill SaaS product routes.
 *
 * Accepts two auth methods:
 *   1. Clerk JWT — for external tenants using the /app product portal
 *   2. WHC session token — fallback so existing /internal routes can
 *      share the same DocuFill handlers (requireInternalAuth stamps
 *      req.internalAccountId before this middleware runs on shared routes)
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
