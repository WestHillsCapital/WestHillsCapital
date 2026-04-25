/**
 * Server-side session store — Postgres-backed.
 *
 * After verifying a Google ID token via /api/internal/auth/verify, the server
 * issues a random 64-character session token that the client stores in
 * localStorage and sends as `Authorization: Bearer <token>` on every
 * subsequent internal API call.
 *
 * Using Postgres instead of an in-memory Map means sessions survive restarts
 * and work across multiple server instances.
 */

import crypto from "node:crypto";
import { getDb } from "../db";
import { logger } from "./logger";

export interface SessionPayload {
  email:     string;
  accountId: number;
}

// ── Automatic expiry cleanup ──────────────────────────────────────────────────
// Runs every 15 minutes to prevent the table from accumulating stale rows.
setInterval(async () => {
  try {
    const db = getDb();
    const { rowCount } = await db.query(`DELETE FROM internal_sessions WHERE expires_at <= NOW()`);
    if ((rowCount ?? 0) > 0) {
      logger.debug({ purged: rowCount }, "[Sessions] Expired sessions purged");
    }
  } catch {
    // Non-fatal — DB might not be ready yet on the very first tick
  }
}, 15 * 60 * 1000).unref();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a session for the given email + account.
 * `googleExpiresAt` is the `exp` claim from the Google ID token (in ms).
 * The session will expire at that time, floored to 5 min and capped at 8 hours.
 */
export async function createSession(
  email:           string,
  accountId:       number,
  googleExpiresAt: number,
): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex"); // 64-char hex string
  const now   = Date.now();
  const expiresMs = Math.min(
    now + 8 * 60 * 60 * 1000,
    Math.max(googleExpiresAt, now + 5 * 60 * 1000),
  );
  const expiresAt = new Date(expiresMs);
  const db = getDb();
  await db.query(
    `INSERT INTO internal_sessions (token, email, account_id, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [token, email.toLowerCase(), accountId, expiresAt],
  );
  logger.info({ email, accountId }, "[Sessions] Session created");
  return token;
}

/**
 * Validate a session token.
 * Returns { email, accountId } if the token is valid and not expired; null otherwise.
 */
export async function validateSession(token: string): Promise<SessionPayload | null> {
  const db = getDb();
  const { rows } = await db.query<{ email: string; account_id: number }>(
    `SELECT email, account_id FROM internal_sessions
      WHERE token = $1 AND expires_at > NOW()`,
    [token],
  );
  const row = rows[0];
  if (!row) return null;
  return { email: row.email, accountId: Number(row.account_id) };
}

/**
 * Revoke a session (sign-out).
 * No-op if the token doesn't exist.
 */
export async function revokeSession(token: string): Promise<void> {
  const db = getDb();
  await db.query(`DELETE FROM internal_sessions WHERE token = $1`, [token]);
  logger.info("[Sessions] Session revoked");
}
