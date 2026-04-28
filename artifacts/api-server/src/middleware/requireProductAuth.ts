import type { RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { getDb } from "../db";
import { logger } from "../lib/logger";
import { resolveApiKeyAccountId } from "./requireApiKeyAuth";
import { isRateLimited, isCurrentlyBlocked } from "../lib/ratelimit";
import { linkPendingInvitation } from "../lib/auth-utils";

const APIKEY_FAIL_MAX = 10;
const APIKEY_FAIL_WINDOW_MS = 60 * 1000;

/**
 * Auth middleware for the Docuplete SaaS product routes.
 *
 * Accepts three auth methods (in order):
 *   1. req.internalAccountId already set — pass through (e.g. requireInternalAuth ran first)
 *   2. Clerk JWT — for tenants using the /app product portal
 *   3. API key (Authorization: Bearer sk_live_…) — for external integration partners
 *
 * Sets req.internalAccountId and req.productUserRole on success; returns 401 otherwise.
 */
const AUTH_DISABLED = !process.env["GOOGLE_CLIENT_ID"] && !process.env["CLERK_SECRET_KEY"];

export const requireProductAuth: RequestHandler = async (req, res, next) => {
  if (AUTH_DISABLED) {
    req.internalAccountId  = req.internalAccountId ?? 1;
    req.productUserRole    = req.productUserRole ?? "admin";
    return next();
  }

  if (req.internalAccountId !== undefined) {
    // Already authenticated (e.g. by requireInternalAuth); treat as admin.
    req.productUserRole = req.productUserRole ?? "admin";
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
    req.productUserRole   = "member";
    return next();
  }

  const auth = getAuth(req);
  const clerkUserId = auth?.userId;

  if (!clerkUserId) {
    return void res.status(401).json({ error: "Authentication required." });
  }

  try {
    const result = await getDb().query<{ id: number; account_id: number; role: string; totp_enabled: boolean }>(
      `SELECT id, account_id, role, totp_enabled FROM account_users
        WHERE clerk_user_id = $1 AND status = 'active'
        LIMIT 1`,
      [clerkUserId],
    );

    if (result.rows[0]) {
      const uid       = result.rows[0].id;
      const sessionId = auth?.sessionId ?? null;
      const ip        = req.ip ?? req.socket?.remoteAddress ?? null;
      const ua        = req.headers["user-agent"] ?? null;

      // Check if this Clerk session has been revoked in our DB
      if (sessionId) {
        const { rows: sessionCheck } = await getDb().query<{ revoked_at: Date | null; totp_verified: boolean }>(
          `SELECT revoked_at, totp_verified FROM user_active_sessions WHERE clerk_session_id = $1 LIMIT 1`,
          [sessionId],
        );
        if (sessionCheck.length > 0 && sessionCheck[0].revoked_at !== null) {
          return void res.status(401).json({ error: "This session has been revoked. Please sign in again.", code: "SESSION_REVOKED" });
        }

        // Enforce 2FA: if the user has TOTP enabled, the session must be verified
        if (result.rows[0].totp_enabled) {
          const sessionVerified = sessionCheck.length > 0 && sessionCheck[0].totp_verified === true;
          if (!sessionVerified) {
            return void res.status(403).json({ error: "Two-factor authentication required.", code: "TOTP_REQUIRED" });
          }
        }
      } else if (result.rows[0].totp_enabled) {
        // No session ID available — cannot verify 2FA, block access
        return void res.status(403).json({ error: "Two-factor authentication required.", code: "TOTP_REQUIRED" });
      }

      req.internalAccountId = result.rows[0].account_id;
      req.productUserRole   = result.rows[0].role;

      // Fire-and-forget: stamp last_seen_at and upsert the session record
      getDb()
        .query(`UPDATE account_users SET last_seen_at = NOW() WHERE clerk_user_id = $1`, [clerkUserId])
        .then(async () => {
          if (uid && sessionId) {
            const db2 = getDb();
            // Upsert active session (new session → also write login history)
            const upRes = await db2.query<{ was_new: boolean }>(
              `INSERT INTO user_active_sessions (account_id, user_id, clerk_session_id, ip_address, user_agent)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (clerk_session_id) DO UPDATE
                   SET last_active_at = NOW(),
                       ip_address = EXCLUDED.ip_address,
                       user_agent = EXCLUDED.user_agent
                 RETURNING (xmax = 0) AS was_new`,
              [result.rows[0].account_id, uid, sessionId, ip, ua],
            );
            const wasNew = (upRes.rows[0] as Record<string, unknown> | undefined)?.was_new as boolean | undefined;
            if (wasNew) {
              await db2.query(
                `INSERT INTO user_login_history (account_id, user_id, clerk_session_id, ip_address, user_agent)
                   VALUES ($1, $2, $3, $4, $5)`,
                [result.rows[0].account_id, uid, sessionId, ip, ua],
              );
            }
          }
        })
        .catch(() => {});

      return next();
    }

    // No active record — try to link a pending invitation by Clerk email
    const linked = await linkPendingInvitation(clerkUserId);
    if (linked) {
      req.internalAccountId = linked.account_id;
      req.productUserRole   = linked.role;
      return next();
    }

    // User is authenticated (valid Clerk session) but has no account in our DB.
    // Return 404 so the client can display the onboarding form — 401 would
    // incorrectly imply the Clerk session itself is invalid.
    return void res.status(404).json({
      error: "Account not found. Please complete sign-up.",
      code: "ACCOUNT_NOT_FOUND",
    });
  } catch (err) {
    logger.error({ err }, "[ProductAuth] DB error resolving Clerk user");
    return void res.status(503).json({ error: "Auth service unavailable." });
  }
};
