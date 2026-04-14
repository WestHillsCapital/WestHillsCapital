import { Router, type IRouter } from "express";
import { OAuth2Client } from "google-auth-library";
import { logger } from "../lib/logger.js";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";

// Comma-separated list of allowed Google account emails.
// If unset / empty, ALL accounts are blocked (fail-closed for safety).
const ALLOWED_EMAILS: Set<string> = (() => {
  const raw = process.env.INTERNAL_ALLOWED_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
})();

const googleClient = new OAuth2Client(CLIENT_ID);

const router: IRouter = Router();

// POST /api/internal/auth/verify
// Body: { credential: string }  — the Google ID token from the sign-in button
// Returns: { ok: true, email, name, picture, expiresAt }
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

  // Verify the Google ID token
  let payload: Awaited<ReturnType<(typeof googleClient)["verifyIdToken"]>> extends { getPayload(): infer P } ? P : never;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: CLIENT_ID,
    });
    payload = ticket.getPayload();
    if (!payload) throw new Error("Empty token payload");
  } catch (err) {
    logger.warn({ err }, "[InternalAuth] Token verification failed");
    return void res.status(401).json({ error: "Invalid or expired Google token." });
  }

  const email = (payload.email ?? "").toLowerCase();

  if (ALLOWED_EMAILS.size === 0) {
    logger.warn("[InternalAuth] INTERNAL_ALLOWED_EMAILS is not set — blocking all access");
    return void res.status(403).json({
      error:
        "Internal access is not configured. Ask the administrator to set INTERNAL_ALLOWED_EMAILS.",
    });
  }

  if (!ALLOWED_EMAILS.has(email)) {
    logger.warn({ email }, "[InternalAuth] Email not in allowed list");
    return void res.status(403).json({
      error: "Your Google account is not authorized for internal access.",
    });
  }

  logger.info({ email }, "[InternalAuth] Access granted");

  return void res.json({
    ok: true,
    email,
    name:      payload.name    ?? email,
    picture:   payload.picture ?? null,
    expiresAt: (payload.exp ?? 0) * 1000,  // convert to ms
  });
});

export default router;
