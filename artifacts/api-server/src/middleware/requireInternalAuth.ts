import type { RequestHandler } from "express";
import { validateSession } from "../lib/session-store";
import { logger } from "../lib/logger";

// Augment the Express Request type so downstream route handlers can read
// req.internalEmail without casting.
declare global {
  namespace Express {
    interface Request {
      internalEmail?: string;
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
export const requireInternalAuth: RequestHandler = (req, res, next) => {
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

  const email = validateSession(token);
  if (!email) {
    logger.warn(
      { path: req.path, method: req.method },
      "[InternalAuth] Invalid or expired session token",
    );
    return void res.status(401).json({
      error: "Session expired. Please sign in again.",
    });
  }

  req.internalEmail = email;
  next();
};
