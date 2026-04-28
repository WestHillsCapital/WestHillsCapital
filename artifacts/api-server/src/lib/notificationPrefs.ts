import { getDb } from "../db";
import { logger } from "./logger";

export type NotificationChannel = "email" | "in_app";

export type NotificationEventKey =
  | "submission_received"
  | "team_member_joined"
  | "team_member_removed"
  | "billing_plan_change"
  | "billing_payment_failed"
  | "api_key_created"
  | "api_key_revoked"
  | "plan_limit_warning";

/**
 * Returns email addresses of all active org members who want to receive
 * email notifications for the given event.
 *
 * Users with no saved row default to opted-in (email_enabled = true).
 * Silently returns an empty list on DB error to avoid blocking callers.
 */
export async function getUserEmailsToNotify(
  accountId: number,
  eventKey: NotificationEventKey,
): Promise<string[]> {
  try {
    const db = getDb();
    const { rows } = await db.query<{ email: string }>(
      `SELECT au.email
         FROM account_users au
         LEFT JOIN user_notification_prefs unp
           ON unp.account_id    = au.account_id
          AND unp.clerk_user_id = au.clerk_user_id
          AND unp.event_key     = $2
        WHERE au.account_id = $1
          AND au.status     = 'active'
          AND au.email IS NOT NULL
          AND au.email <> ''
          AND COALESCE(unp.email_enabled, true) = true`,
      [accountId, eventKey],
    );
    return rows.map(r => r.email).filter(Boolean);
  } catch (err) {
    logger.error({ err, accountId, eventKey }, "[NotificationPrefs] getUserEmailsToNotify error — defaulting to empty");
    return [];
  }
}

/**
 * Checks whether a specific user's notification preference is enabled
 * for the given event and channel.
 *
 * Defaults to true (opted-in) when no preference row exists.
 * Defaults to true on DB error (fail-open so users aren't silently un-subscribed).
 */
export async function isNotificationEnabled(
  accountId: number,
  clerkUserId: string,
  eventKey: NotificationEventKey,
  channel: NotificationChannel,
): Promise<boolean> {
  try {
    const db = getDb();
    const col = channel === "email" ? "email_enabled" : "in_app_enabled";
    const { rows } = await db.query<{ enabled: boolean }>(
      `SELECT ${col} AS enabled
         FROM user_notification_prefs
        WHERE account_id    = $1
          AND clerk_user_id = $2
          AND event_key     = $3`,
      [accountId, clerkUserId, eventKey],
    );
    if (!rows[0]) return true;
    return rows[0].enabled;
  } catch (err) {
    logger.error({ err, accountId, clerkUserId, eventKey, channel }, "[NotificationPrefs] isNotificationEnabled error — defaulting to true");
    return true;
  }
}
