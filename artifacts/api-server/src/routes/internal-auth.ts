import { Router, type IRouter } from "express";
import { OAuth2Client, type TokenPayload } from "google-auth-library";
import { logger } from "../lib/logger.js";
import { createSession, revokeSession } from "../lib/session-store";
import { getDb } from "../db";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";

// Comma-separated list of allowed Google account emails.
// If unset / empty, ALL accounts are blocked (fail-closed for safety).
const ALLOWED_EMAILS: Set<string> = (() => {
  const raw = process.env.INTERNAL_ALLOWED_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
})();

const googleClient = new OAuth2Client(CLIENT_ID);

const router: IRouter = Router();

// POST /api/internal/auth/verify
// Body: { credential: string }  — the Google ID token from the sign-in button
// Returns: { ok, email, name, picture, expiresAt, sessionToken }
// The sessionToken must be passed as `Authorization: Bearer <sessionToken>` on
// every subsequent request to /api/internal/* and /api/deals/*.
router.post("/verify", async (req, res) => {
  if (!CLIENT_ID) {
    logger.error("[InternalAuth] GOOGLE_CLIENT_ID env var is not set");
    return void res.status(503).json({
      error: "Google auth is not configured on the server. Set GOOGLE_CLIENT_ID.",
    });
  }

  const { credential } = req.body as { credential?: string };
  if (!credential || typeof credential !== "string") {
    return void res.status(400).json({ error: "credential is required" });
  }

  // ── Verify the Google ID token ──────────────────────────────────────────
  let payload: TokenPayload | undefined;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken:  credential,
      audience: CLIENT_ID,
    });
    payload = ticket.getPayload();
    if (!payload) throw new Error("Empty token payload");
  } catch (err) {
    logger.warn({ err }, "[InternalAuth] Token verification failed");
    return void res
      .status(401)
      .json({ error: "Invalid or expired Google token." });
  }

  const email = (payload.email ?? "").toLowerCase();

  // ── Allowlist check ─────────────────────────────────────────────────────
  if (ALLOWED_EMAILS.size === 0) {
    logger.warn("[InternalAuth] INTERNAL_ALLOWED_EMAILS is not set — blocking all access");
    return void res.status(403).json({
      error:
        "Internal access is not configured. Ask the administrator to set INTERNAL_ALLOWED_EMAILS.",
    });
  }

  if (!ALLOWED_EMAILS.has(email)) {
    logger.warn({ email }, "[InternalAuth] Email not in allowed list");
    return void res
      .status(403)
      .json({ error: "Your Google account is not authorized for internal access." });
  }

  // ── Resolve account ─────────────────────────────────────────────────────
  // Look up which account this user belongs to. If they're in ALLOWED_EMAILS
  // but not yet in account_users, auto-provision them into the WHC account.
  const db = getDb();
  let accountId = 1; // default: West Hills Capital
  try {
    const { rows } = await db.query<{ account_id: number }>(
      `SELECT account_id FROM account_users WHERE lower(email) = $1 LIMIT 1`,
      [email],
    );
    if (rows[0]) {
      accountId = Number(rows[0].account_id);
    } else {
      // Auto-provision: user is in the allowlist but not yet in account_users
      await db.query(
        `INSERT INTO account_users (account_id, email, role)
         VALUES (1, $1, 'admin')
         ON CONFLICT (account_id, email) DO NOTHING`,
        [email],
      );
      accountId = 1;
      logger.info({ email }, "[InternalAuth] Auto-provisioned user into WHC account");
    }
  } catch (err) {
    logger.error({ err, email }, "[InternalAuth] Failed to resolve account — defaulting to 1");
    accountId = 1;
  }

  // ── Issue a server-side session token ───────────────────────────────────
  const googleExpiresAt = (payload.exp ?? 0) * 1_000; // seconds → ms
  const sessionToken    = await createSession(email, accountId, googleExpiresAt);

  logger.info({ email, accountId }, "[InternalAuth] Access granted — session created");

  return void res.json({
    ok:           true,
    email,
    name:         payload.name    ?? email,
    picture:      payload.picture ?? null,
    expiresAt:    googleExpiresAt,
    sessionToken,
  });
});

// POST /api/internal/auth/signout
// Body: (empty)
// Header: Authorization: Bearer <sessionToken>
// Revokes the server-side session so the token cannot be replayed.
router.post("/signout", async (req, res) => {
  const authHeader = req.headers["authorization"] ?? "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) await revokeSession(token).catch(() => {});
  }
  res.json({ ok: true });
});

export default router;
