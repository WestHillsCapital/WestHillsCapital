/**
 * Server-side session store.
 *
 * After verifying a Google ID token via /api/internal/auth/verify, the server
 * issues a random 64-character session token that the client stores in
 * localStorage and sends as `Authorization: Bearer <token>` on every
 * subsequent internal API call.
 *
 * This is intentionally lightweight — a single-user internal portal running
 * on one Railway instance. If multiple instances / replicas are ever needed,
 * swap the Map for a Redis or Postgres store.
 */

import crypto from "node:crypto";
import { logger } from "./logger";

interface Session {
  email:     string;
  expiresAt: number; // ms
}

const sessions = new Map<string, Session>();

// ── Automatic expiry cleanup ──────────────────────────────────────────────────
// Runs every 15 minutes. For a single-user portal this is mostly cosmetic, but
// it prevents the Map from accumulating stale entries across many sign-ins.
setInterval(() => {
  const now = Date.now();
  let purged = 0;
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) {
      sessions.delete(token);
      purged++;
    }
  }
  if (purged > 0) {
    logger.debug({ purged }, "[Sessions] Expired sessions purged");
  }
}, 15 * 60 * 1000).unref();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a session for the given email.
 * `googleExpiresAt` is the `exp` claim from the Google ID token (in ms).
 * The session will expire at that time, floored to 5 min and capped at 8 hours
 * so that very-short or very-long Google tokens get a sensible window.
 */
export function createSession(email: string, googleExpiresAt: number): string {
  const token = crypto.randomBytes(32).toString("hex"); // 64-char hex string
  const now   = Date.now();
  const expiresAt = Math.min(
    now + 8 * 60 * 60 * 1000,           // cap at 8 hours
    Math.max(googleExpiresAt, now + 5 * 60 * 1000), // at least 5 min
  );
  sessions.set(token, { email, expiresAt });
  logger.info({ email }, "[Sessions] Session created");
  return token;
}

/**
 * Validate a session token.
 * Returns the email if the token is valid and not expired; null otherwise.
 */
export function validateSession(token: string): string | null {
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session.email;
}

/**
 * Revoke a session (sign-out).
 * No-op if the token doesn't exist.
 */
export function revokeSession(token: string): void {
  sessions.delete(token);
  logger.info("[Sessions] Session revoked");
}
