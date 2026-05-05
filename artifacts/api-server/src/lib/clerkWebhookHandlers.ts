import { Webhook } from "svix";
import { getDb } from "../db";
import { logger } from "./logger";

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
 * Processes a verified Clerk webhook event.
 * For session lifecycle events (ended, revoked, removed), marks the corresponding
 * row in user_active_sessions as revoked.
 */
export async function handleClerkWebhookEvent(event: { type: string; data: Record<string, unknown> }): Promise<void> {
  if (!SESSION_ENDED_EVENTS.has(event.type)) {
    logger.debug({ eventType: event.type }, "[ClerkWebhook] Ignoring non-session event");
    return;
  }

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
}
