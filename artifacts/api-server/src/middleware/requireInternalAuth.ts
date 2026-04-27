import type { RequestHandler } from "express";
import { validateSession } from "../lib/session-store";
import { logger } from "../lib/logger";

// Augment the Express Request type so downstream route handlers can read
// req.internalEmail and req.internalAccountId without casting.
declare global {
  namespace Express {
    interface Request {
      internalEmail?:     string;
      internalAccountId?: number;
      /** Role of the authenticated product/SaaS user (admin | member | readonly). Unset for internal-portal or API-key auth. */
      productUserRole?:   string;
    }
  }
}

/**
 * Middleware that gates access to internal API routes.
 *
 * Expects:  Authorization: Bearer <session-token>
 *
 * The session token is issued by POST /api/internal/auth/verify after a
 * successful Google ID-token verification. The client stores it in
 * localStorage and attaches it to every request to /api/internal/* and
 * /api/deals/*.
 *
 * Returns 401 if the token is missing or expired; 403 if the token is
 * valid but the route further restricts access.
 */
// When GOOGLE_CLIENT_ID is not configured (local / Replit dev environment),
// Google sign-in cannot work so there is no way to obtain a valid session token.
// In that case skip auth entirely and default to WHC account (id=1).
const AUTH_DISABLED = !process.env["GOOGLE_CLIENT_ID"];

export const requireInternalAuth: RequestHandler = async (req, res, next) => {
  if (AUTH_DISABLED) {
    req.internalEmail     = "dev@local";
    req.internalAccountId = 1;
    return next();
  }

  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return void res.status(401).json({
      error: "Authentication required. Sign in to the internal portal.",
    });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return void res.status(401).json({ error: "Empty session token." });
  }

  let session: { email: string; accountId: number } | null = null;
  try {
    session = await validateSession(token);
  } catch (err) {
    logger.error({ err, path: req.path }, "[InternalAuth] Session validation DB error");
    return void res.status(503).json({ error: "Auth service unavailable. Try again." });
  }

  if (!session) {
    logger.warn(
      { path: req.path, method: req.method },
      "[InternalAuth] Invalid or expired session token",
    );
    return void res.status(401).json({
      error: "Session expired. Please sign in again.",
    });
  }

  req.internalEmail     = session.email;
  req.internalAccountId = session.accountId;
  next();
};
