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

// ── Public API ────────────────────────────────────────────────────────────────
// Automatic expiry cleanup is handled by the "prune:sessions" BullMQ repeatable
// job in the worker process (every 15 min). See lib/schedulers.ts + worker.ts.

// Internal portal sessions last 30 days regardless of the short-lived Google
// token that was used to authenticate. The Google token is only used to prove
// identity at sign-in; after that the server issues its own long-lived token.
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Create a session for the given email + account.
 * Returns { token, expiresAt } — pass expiresAt back to the client so it knows
 * when to prompt for re-authentication.
 */
export async function createSession(
  email:     string,
  accountId: number,
): Promise<{ token: string; expiresAt: number }> {
  const token     = crypto.randomBytes(32).toString("hex"); // 64-char hex string
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const db = getDb();
  await db.query(
    `INSERT INTO internal_sessions (token, email, account_id, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [token, email.toLowerCase(), accountId, expiresAt],
  );
  logger.info({ email, accountId }, "[Sessions] Session created");
  return { token, expiresAt: expiresAt.getTime() };
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
