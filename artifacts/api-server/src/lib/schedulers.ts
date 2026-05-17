/**
 * Scheduler processor functions for BullMQ repeatable jobs.
 *
 * These functions were previously triggered by setInterval calls in the API
 * server process (session-store.ts and index.ts). They now run as BullMQ
 * repeatable jobs in the worker process, which ensures exactly-once execution
 * regardless of how many worker instances are running.
 *
 * The worker registers each job via queue.upsertJobScheduler() on startup and
 * dispatches to these functions by job name. See worker.ts for registration.
 */

import * as Sentry from "@sentry/node";
import { getDb } from "../db.js";
import { logger } from "./logger.js";
import { syncDealOpsStatus, updateOperationsMilestone, computeOpsStatus } from "./google-sheets.js";
import {
  sendShippingNotificationEmail,
  sendFollowUp7DayEmail,
  sendFollowUp30DayEmail,
  sendSessionReminderEmail,
  getOrgEmailSettings,
} from "./email.js";
import { getShippingStatus } from "./fiztrade.js";

// ── Internal session cleanup ──────────────────────────────────────────────────
// Deletes expired rows from internal_sessions.
// Previously a setInterval (every 15 min) in session-store.ts.

export async function pruneInternalSessions(): Promise<void> {
  try {
    const db = getDb();
    const { rowCount } = await db.query(
      `DELETE FROM internal_sessions WHERE expires_at <= NOW()`,
    );
    if ((rowCount ?? 0) > 0) {
      logger.debug({ purged: rowCount }, "[Sessions] Expired sessions purged");
    }
  } catch {
    // Non-fatal
  }
}

// ── Fulfillment scheduler ─────────────────────────────────────────────────────
// Handles shipping emails, 7d/30d follow-up emails, backfills follow-up
// schedule timestamps, and syncs Ops status to Google Sheets.
// Previously a setInterval (every 15 min) in index.ts (runScheduler).

type SchedulerDeal = {
  id:                                  number;
  first_name:                          string;
  email:                               string;
  locked_at:                           Date;
  payment_received_at:                 Date | null;
  tracking_number:                     string | null;
  order_placed_at:                     Date | null;
  wire_received_at:                    Date | null;
  order_paid_at:                       Date | null;
  shipped_at:                          Date | null;
  delivered_at:                        Date | null;
  shipping_notification_scheduled_at:  Date | null;
  shipping_email_sent_at:              Date | null;
  delivery_email_sent_at:              Date | null;
  follow_up_7d_scheduled_at:           Date | null;
  follow_up_7d_sent_at:                Date | null;
  follow_up_30d_scheduled_at:          Date | null;
  follow_up_30d_sent_at:               Date | null;
};

export async function runFulfillmentScheduler(): Promise<void> {
  try {
    const db = getDb();

    const { rows } = await db.query<SchedulerDeal>(
      `SELECT
         id, first_name, email,
         locked_at, payment_received_at, tracking_number, order_placed_at,
         wire_received_at, order_paid_at, shipped_at, delivered_at,
         shipping_notification_scheduled_at, shipping_email_sent_at,
         delivery_email_sent_at,
         follow_up_7d_scheduled_at, follow_up_7d_sent_at,
         follow_up_30d_scheduled_at, follow_up_30d_sent_at
       FROM deals
       WHERE status IN ('locked', 'executed')
         AND (
               shipping_email_sent_at IS NULL
            OR delivered_at IS NULL
            OR (follow_up_7d_scheduled_at  IS NOT NULL AND follow_up_7d_sent_at  IS NULL)
            OR (follow_up_30d_scheduled_at IS NOT NULL AND follow_up_30d_sent_at IS NULL)
         )
       ORDER BY id DESC
       LIMIT 500`,
    );

    if (rows.length === 0) return;

    logger.info({ count: rows.length }, "[Scheduler] Starting fulfillment scheduler tick");

    const now = new Date();

    for (const deal of rows) {
      // ── 1. Shipping email (Email 2) ─────────────────────────────────────────
      if (
        deal.shipping_notification_scheduled_at &&
        deal.shipping_notification_scheduled_at <= now &&
        !deal.shipping_email_sent_at &&
        deal.tracking_number
      ) {
        try {
          await sendShippingNotificationEmail({
            firstName:      deal.first_name,
            email:          deal.email,
            trackingNumber: deal.tracking_number,
          });

          await db.query(
            `UPDATE deals
                SET shipped_at             = COALESCE(shipped_at, NOW()),
                    shipping_email_sent_at = NOW(),
                    updated_at             = NOW()
              WHERE id = $1`,
            [deal.id],
          );
          deal.shipped_at             = deal.shipped_at ?? now;
          deal.shipping_email_sent_at = now;

          logger.info({ dealId: deal.id }, "[Scheduler] Shipping notification email sent");

          updateOperationsMilestone(deal.id, {
            "Shipped Date": now.toLocaleString(),
            "Status":       "Shipped",
          }).catch((err) =>
            logger.error({ err, dealId: deal.id }, "[Scheduler] Ops tab shipping update failed"),
          );
        } catch (err) {
          logger.error({ err, dealId: deal.id }, "[Scheduler] Failed to send shipping notification email");
        }
      }

      // ── 2. Backfill follow-up schedule timestamps ───────────────────────────
      if (deal.delivered_at) {
        if (!deal.follow_up_7d_scheduled_at || !deal.follow_up_30d_scheduled_at) {
          try {
            await db.query(
              `UPDATE deals
                  SET follow_up_7d_scheduled_at  = COALESCE(follow_up_7d_scheduled_at,  delivered_at + INTERVAL '7 days'),
                      follow_up_30d_scheduled_at = COALESCE(follow_up_30d_scheduled_at, delivered_at + INTERVAL '30 days'),
                      updated_at                 = NOW()
                WHERE id = $1`,
              [deal.id],
            );
            logger.info({ dealId: deal.id }, "[Scheduler] Backfilled follow-up schedule timestamps");
          } catch (err) {
            logger.error({ err, dealId: deal.id }, "[Scheduler] Failed to backfill follow-up schedules");
          }
        }
      }

      // ── 3. 7-day follow-up email (Email 4) ─────────────────────────────────
      if (
        deal.follow_up_7d_scheduled_at &&
        deal.follow_up_7d_scheduled_at <= now &&
        !deal.follow_up_7d_sent_at
      ) {
        try {
          await sendFollowUp7DayEmail({
            firstName: deal.first_name,
            email:     deal.email,
          });

          await db.query(
            `UPDATE deals SET follow_up_7d_sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
            [deal.id],
          );
          deal.follow_up_7d_sent_at = now;

          logger.info({ dealId: deal.id }, "[Scheduler] 7-day follow-up email sent");
        } catch (err) {
          logger.error({ err, dealId: deal.id }, "[Scheduler] Failed to send 7-day follow-up email");
        }
      }

      // ── 4. 30-day follow-up email (Email 5) ────────────────────────────────
      if (
        deal.follow_up_30d_scheduled_at &&
        deal.follow_up_30d_scheduled_at <= now &&
        !deal.follow_up_30d_sent_at
      ) {
        try {
          await sendFollowUp30DayEmail({
            firstName: deal.first_name,
            email:     deal.email,
          });

          await db.query(
            `UPDATE deals SET follow_up_30d_sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
            [deal.id],
          );
          deal.follow_up_30d_sent_at = now;

          logger.info({ dealId: deal.id }, "[Scheduler] 30-day follow-up email sent");
        } catch (err) {
          logger.error({ err, dealId: deal.id }, "[Scheduler] Failed to send 30-day follow-up email");
        }
      }

      // ── 5. Sync Deals + Operations tab Ops status ───────────────────────────
      const dealForStatus = {
        id:                  deal.id,
        lockedAt:            deal.locked_at,
        paymentReceivedAt:   deal.payment_received_at,
        trackingNumber:      deal.tracking_number,
        orderPlacedAt:       deal.order_placed_at,
        wireReceivedAt:      deal.wire_received_at,
        orderPaidAt:         deal.order_paid_at,
        shippedAt:           deal.shipped_at,
        deliveredAt:         deal.delivered_at,
        shippingEmailSentAt: deal.shipping_email_sent_at,
      };
      const computedStatus = computeOpsStatus(dealForStatus);

      syncDealOpsStatus(dealForStatus).catch((err) =>
        logger.error({ err, dealId: deal.id }, "[Scheduler] Deals tab sync failed"),
      );

      updateOperationsMilestone(deal.id, { "Status": computedStatus }).catch((err) =>
        logger.error({ err, dealId: deal.id }, "[Scheduler] Operations tab status sync failed"),
      );
    }

    logger.info({ count: rows.length }, "[Scheduler] Fulfillment scheduler tick complete");
  } catch (err) {
    logger.error({ err }, "[Scheduler] Scheduler run failed (non-fatal)");
    Sentry.captureException(err, { tags: { scheduler: "fulfillment" } });
  }
}

// ── Tracking sync ─────────────────────────────────────────────────────────────
// Polls Dillon Gage for tracking numbers on unshipped executed deals.
// Previously a setInterval+setTimeout combination (every 15 min, 2-min offset)
// in index.ts (runTrackingSync). The 2-minute offset was only used to avoid
// collision with runScheduler in a single process — not needed with BullMQ's
// worker-level serialization.

export async function runTrackingSync(): Promise<void> {
  try {
    const db = getDb();

    const { rows: pending } = await db.query<{
      id:                       number;
      supplier_confirmation_id: string;
    }>(
      `SELECT id, supplier_confirmation_id
         FROM deals
        WHERE supplier_confirmation_id IS NOT NULL
          AND supplier_confirmation_id NOT LIKE 'DRY-%'
          AND tracking_number IS NULL
          AND delivered_at IS NULL
          AND status IN ('locked', 'executed')
        ORDER BY id DESC
        LIMIT 100`,
    );

    if (pending.length === 0) return;

    const confirmationNumbers = pending.map((r) => r.supplier_confirmation_id);
    logger.info(
      { count: confirmationNumbers.length },
      "[TrackingSync] Polling DG for shipping status",
    );

    const statuses = await getShippingStatus(confirmationNumbers);
    const byConfirmation = new Map(statuses.map((s) => [s.confirmationNumber, s]));

    for (const deal of pending) {
      const status = byConfirmation.get(deal.supplier_confirmation_id);
      if (!status) continue;

      const rawTracking = status.trackingNumbers?.trim();
      if (!rawTracking || status.statusDesc?.toLowerCase() !== "shipped") continue;

      const trackingNumber = rawTracking.split(";")[0].trim();
      if (!trackingNumber) continue;

      try {
        await db.query(
          `UPDATE deals
              SET tracking_number                    = $1,
                  shipping_notification_scheduled_at = NOW() + INTERVAL '24 hours',
                  updated_at                         = NOW()
            WHERE id = $2
              AND tracking_number IS NULL`,
          [trackingNumber, deal.id],
        );

        logger.info(
          { dealId: deal.id, trackingNumber, confirmationNumber: deal.supplier_confirmation_id },
          "[TrackingSync] Tracking number auto-populated from DG",
        );

        updateOperationsMilestone(deal.id, {
          "Tracking Number": trackingNumber,
          "Status":          "Label Created",
        }).catch((err) =>
          logger.error({ err, dealId: deal.id }, "[TrackingSync] Ops tab update failed"),
        );
      } catch (err) {
        logger.error({ err, dealId: deal.id }, "[TrackingSync] Failed to update tracking number");
      }
    }
  } catch (err) {
    logger.error({ err }, "[TrackingSync] Tracking sync run failed (non-fatal)");
    Sentry.captureException(err, { tags: { scheduler: "tracking-sync" } });
  }
}

// ── Session expiry reminder ───────────────────────────────────────────────────
// Finds pending/in-progress sessions expiring within 48 hours that have a
// known client email and haven't been reminded yet, then sends one reminder
// email per session and stamps reminder_sent_at.

export async function sendExpiringSessionReminders(): Promise<void> {
  try {
    const db = getDb();

    const { rows } = await db.query<{
      id:                   number;
      token:                string;
      account_id:           number;
      expires_at:           Date;
      link_email_recipient: string;
      prefill:              Record<string, unknown>;
      custom_domain:        string | null;
      org_name:             string;
      org_logo_url:         string | null;
      org_brand_color:      string | null;
      app_origin:           string | null;
    }>(
      `SELECT
         dis.id,
         dis.token,
         dis.account_id,
         dis.expires_at,
         dis.link_email_recipient,
         dis.prefill,
         a.custom_domain,
         a.name          AS org_name,
         a.logo_url      AS org_logo_url,
         a.brand_color   AS org_brand_color,
         a.app_origin
       FROM docuplete_interview_sessions dis
       JOIN accounts a ON a.id = dis.account_id
      WHERE dis.status        IN ('draft', 'pending', 'in_progress')
        AND dis.expires_at     > NOW() + INTERVAL '0 hours'
        AND dis.expires_at    <= NOW() + INTERVAL '48 hours'
        AND dis.reminder_sent_at IS NULL
        AND dis.link_email_recipient IS NOT NULL
        AND dis.link_email_recipient <> ''
      LIMIT 500`,
    );

    if (rows.length === 0) return;

    logger.info({ count: rows.length }, "[SessionReminders] Sending expiry reminder emails");

    let sent = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const appOrigin =
          row.app_origin ??
          (process.env.APP_ORIGIN ??
            (process.env.REPLIT_DEV_DOMAIN
              ? `https://${process.env.REPLIT_DEV_DOMAIN}`
              : "https://docuplete.com"));
        const origin       = row.custom_domain ? `https://${row.custom_domain}` : appOrigin;
        const interviewUrl = `${origin}/docuplete/public/${row.token}`;

        const prefill      = typeof row.prefill === "object" && row.prefill !== null ? row.prefill : {};
        const recipientName = String(
          prefill["first_name"] && prefill["last_name"]
            ? `${prefill["first_name"]} ${prefill["last_name"]}`
            : prefill["first_name"] ?? prefill["name"] ?? row.link_email_recipient,
        );

        const emailSettings = await getOrgEmailSettings(row.account_id);

        await sendSessionReminderEmail({
          recipientEmail: row.link_email_recipient,
          recipientName,
          interviewUrl,
          orgName:        row.org_name || "Docuplete",
          orgLogoUrl:     row.org_logo_url,
          orgBrandColor:  row.org_brand_color,
          expiresAt:      row.expires_at,
          emailSettings,
        });

        await db.query(
          `UPDATE docuplete_interview_sessions
              SET reminder_sent_at = NOW(), updated_at = NOW()
            WHERE id = $1`,
          [row.id],
        );

        sent++;
        logger.debug({ sessionId: row.id, token: row.token }, "[SessionReminders] Reminder sent");
      } catch (err) {
        failed++;
        logger.warn({ err, sessionId: row.id, token: row.token }, "[SessionReminders] Failed to send reminder (non-fatal)");
      }
    }

    logger.info({ sent, failed }, "[SessionReminders] Expiry reminder run complete");
  } catch (err) {
    logger.error({ err }, "[SessionReminders] Reminder scheduler failed (non-fatal)");
    Sentry.captureException(err, { tags: { scheduler: "session-reminders" } });
  }
}
