import { Webhook } from "svix";
import { getDb } from "../db";
import { logger } from "./logger";
import { insertAuditLog } from "./auditLog";

const SESSION_ENDED_EVENTS = new Set([
  "session.ended",
  "session.revoked",
  "session.removed",
]);

/**
 * Verifies a Clerk webhook signature using the raw CLERK_WEBHOOK_SECRET env var
 * and returns the parsed event. Throws if the secret is missing or the signature
 * is invalid.
 */
export function verifyAndParseClerkWebhook(
  payload: Buffer,
  headers: Record<string, string | string[] | undefined>,
): { type: string; data: Record<string, unknown> } {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error(
      "CLERK_WEBHOOK_SECRET is not configured. " +
      "Add this secret from your Clerk Dashboard → Webhooks → your endpoint → Signing Secret.",
    );
  }

  const wh = new Webhook(webhookSecret);

  const svixId        = headers["svix-id"];
  const svixTimestamp = headers["svix-timestamp"];
  const svixSignature = headers["svix-signature"];

  const svixHeaders = {
    "svix-id":        Array.isArray(svixId)        ? svixId[0]        : (svixId        ?? ""),
    "svix-timestamp": Array.isArray(svixTimestamp) ? svixTimestamp[0] : (svixTimestamp ?? ""),
    "svix-signature": Array.isArray(svixSignature) ? svixSignature[0] : (svixSignature ?? ""),
  };

  const verified = wh.verify(payload, svixHeaders) as { type: string; data: Record<string, unknown> };
  return verified;
}

/**
 * Resolves the internal account ID for a Clerk user ID by looking up account_users.
 * Returns null if no matching account is found (e.g. user hasn't completed onboarding).
 */
async function resolveAccountForClerkUser(clerkUserId: string): Promise<{ accountId: number; email: string | null } | null> {
  try {
    const { rows } = await getDb().query<{ account_id: number; email: string | null }>(
      `SELECT account_id, email FROM account_users WHERE clerk_user_id = $1 AND status = 'active' LIMIT 1`,
      [clerkUserId],
    );
    if (!rows[0]) return null;
    return { accountId: rows[0].account_id, email: rows[0].email ?? null };
  } catch {
    return null;
  }
}

/**
 * Processes a verified Clerk webhook event.
 *
 * Handles:
 * - session.ended / session.revoked / session.removed — marks user_active_sessions as revoked
 * - session.created — writes an auth.login audit entry (CC6.1 / CC7.2)
 * - user.authentication_failed — writes an auth.login_failed audit entry
 */
export async function handleClerkWebhookEvent(event: { type: string; data: Record<string, unknown> }): Promise<void> {
  // ── Session ended / revoked ─────────────────────────────────────────────────
  if (SESSION_ENDED_EVENTS.has(event.type)) {
    const clerkSessionId = event.data["id"];
    if (typeof clerkSessionId !== "string" || !clerkSessionId) {
      logger.warn({ eventType: event.type, data: event.data }, "[ClerkWebhook] Session event missing data.id — skipping");
      return;
    }

    const result = await getDb().query(
      `UPDATE user_active_sessions
          SET revoked_at = NOW()
        WHERE clerk_session_id = $1
          AND revoked_at IS NULL`,
      [clerkSessionId],
    );

    logger.info(
      { eventType: event.type, clerkSessionId, rowsUpdated: result.rowCount },
      "[ClerkWebhook] Session marked revoked",
    );
    return;
  }

  // ── Session created → auth.login ────────────────────────────────────────────
  if (event.type === "session.created") {
    const clerkUserId = event.data["user_id"];
    if (typeof clerkUserId !== "string" || !clerkUserId) {
      logger.debug({ eventType: event.type }, "[ClerkWebhook] session.created missing user_id — skipping audit");
      return;
    }

    const account = await resolveAccountForClerkUser(clerkUserId);
    if (!account) {
      logger.debug({ clerkUserId }, "[ClerkWebhook] session.created — no matching account, skipping audit");
      return;
    }

    const clientIp = typeof event.data["last_active_at"] === "string" ? null : null; // IP not in session.created payload
    void insertAuditLog({
      accountId: account.accountId,
      actorEmail: account.email,
      actorUserId: clerkUserId,
      action: "auth.login",
      ip: clientIp,
      metadata: { method: "clerk" },
    });
    logger.debug({ clerkUserId, accountId: account.accountId }, "[ClerkWebhook] auth.login logged");
    return;
  }

  // ── Authentication failed → auth.login_failed ───────────────────────────────
  if (event.type === "user.authentication_failed") {
    const clerkUserId = typeof event.data["user_id"] === "string" ? event.data["user_id"] : null;
    const reason = typeof event.data["reason"] === "string" ? event.data["reason"] : undefined;

    if (clerkUserId) {
      const account = await resolveAccountForClerkUser(clerkUserId);
      if (account) {
        void insertAuditLog({
          accountId: account.accountId,
          actorEmail: account.email,
          actorUserId: clerkUserId,
          action: "auth.login_failed",
          metadata: { reason },
        });
        logger.debug({ clerkUserId, accountId: account.accountId }, "[ClerkWebhook] auth.login_failed logged");
        return;
      }
    }
    // Known user not found — log with a best-effort identifier
    logger.info({ eventType: event.type, clerkUserId, reason }, "[ClerkWebhook] auth.login_failed — no matching account");
    return;
  }

  logger.debug({ eventType: event.type }, "[ClerkWebhook] Ignoring unhandled event type");
}
