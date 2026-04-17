import { Server } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { initDb, getDb } from "./db";
import { validateConfig } from "./lib/config";
import { syncDealOpsStatus, updateOperationsMilestone } from "./lib/google-sheets";

// ── 1. Validate configuration before anything else ────────────────────────────
// Logs all env var statuses and exits immediately if required vars are missing.
// Also logs the DB hostname so Railway logs confirm the correct Postgres target.
validateConfig();

// ── 2. Resolve port ───────────────────────────────────────────────────────────
const rawPort = process.env["PORT"];
if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ── 3. Start listening immediately ────────────────────────────────────────────
// Railway's healthcheck probe hits /healthz within seconds of container start.
// Starting the server before initDb() ensures the probe always finds a live
// server rather than timing out while Postgres schema migrations run.
const server: Server = app.listen(port, () => {
  logger.info({ port }, "Server listening");
});

// ── 4. Initialise the database ────────────────────────────────────────────────
// Runs concurrently with the server. If it fails, the process exits so
// Railway restarts the container (typically because DATABASE_URL is misconfigured).

// ── 4b. Background scheduler — runs every 30 min ─────────────────────────────
//
// Two responsibilities:
//   1. Sync time-based Ops status (Awaiting Wire → At Risk → Cancel Eligible)
//      for all open deals without a tracking number.
//   2. Fulfillment milestone automation:
//      • When shipping_notification_scheduled_at passes → mark shipped_at +
//        shipping_email_sent_at (Task #31 will fire the actual email; the
//        timestamp alone drives the status chain and is enough for Task #30).
//      • When delivered_at is set → schedule 7d / 30d follow-up markers.
//
// All Sheets writes are fire-and-forget (non-fatal).

type SchedulerDeal = {
  id:                                  number;
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
  follow_up_7d_sent_at:                Date | null;
  follow_up_30d_sent_at:               Date | null;
};

async function runScheduler(): Promise<void> {
  try {
    const db = getDb();

    // Fetch all open/in-flight deals (not yet fully delivered+followed up).
    // Broad WHERE to catch anything still in-flight.
    const { rows } = await db.query<SchedulerDeal>(
      `SELECT
         id, locked_at, payment_received_at, tracking_number, order_placed_at,
         wire_received_at, order_paid_at, shipped_at, delivered_at,
         shipping_notification_scheduled_at, shipping_email_sent_at,
         delivery_email_sent_at, follow_up_7d_sent_at, follow_up_30d_sent_at
       FROM deals
       WHERE status IN ('locked', 'executed')
         AND (follow_up_30d_sent_at IS NULL OR delivered_at IS NULL)
       ORDER BY id DESC
       LIMIT 500`
    );

    if (rows.length === 0) return;

    logger.info({ count: rows.length }, "[Scheduler] Starting fulfillment scheduler tick");

    const now = new Date();

    for (const deal of rows) {
      // ── 1. Shipping email scheduling ─────────────────────────────────────
      // When the tracking number has been saved for 24h and the shipping email
      // hasn't fired yet, mark shipped_at + shipping_email_sent_at.
      // The actual email send will be added in Task #31.
      if (
        deal.shipping_notification_scheduled_at &&
        deal.shipping_notification_scheduled_at <= now &&
        !deal.shipping_email_sent_at
      ) {
        try {
          await db.query(
            `UPDATE deals
                SET shipped_at              = COALESCE(shipped_at, NOW()),
                    shipping_email_sent_at  = NOW(),
                    updated_at              = NOW()
              WHERE id = $1`,
            [deal.id],
          );
          deal.shipped_at             = deal.shipped_at ?? now;
          deal.shipping_email_sent_at = now;

          logger.info({ dealId: deal.id }, "[Scheduler] Shipping email milestone marked (email send: Task #31)");

          updateOperationsMilestone(deal.id, {
            "Shipped Date": now.toLocaleString(),
            "Status":       "Shipped",
          }).catch((err) =>
            logger.error({ err, dealId: deal.id }, "[Scheduler] Ops tab shipping update failed")
          );
        } catch (err) {
          logger.error({ err, dealId: deal.id }, "[Scheduler] Failed to mark shipping milestone");
        }
      }

      // ── 2. 7-day follow-up marker ─────────────────────────────────────────
      if (
        deal.delivered_at &&
        !deal.follow_up_7d_sent_at &&
        now.getTime() - new Date(deal.delivered_at).getTime() >= 7 * 24 * 60 * 60 * 1000
      ) {
        try {
          await db.query(
            `UPDATE deals SET follow_up_7d_sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
            [deal.id],
          );
          deal.follow_up_7d_sent_at = now;
          logger.info({ dealId: deal.id }, "[Scheduler] 7-day follow-up marked (email send: Task #31)");
        } catch (err) {
          logger.error({ err, dealId: deal.id }, "[Scheduler] Failed to mark 7d follow-up");
        }
      }

      // ── 3. 30-day follow-up marker ────────────────────────────────────────
      if (
        deal.delivered_at &&
        !deal.follow_up_30d_sent_at &&
        now.getTime() - new Date(deal.delivered_at).getTime() >= 30 * 24 * 60 * 60 * 1000
      ) {
        try {
          await db.query(
            `UPDATE deals SET follow_up_30d_sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
            [deal.id],
          );
          deal.follow_up_30d_sent_at = now;
          logger.info({ dealId: deal.id }, "[Scheduler] 30-day follow-up marked (email send: Task #31)");
        } catch (err) {
          logger.error({ err, dealId: deal.id }, "[Scheduler] Failed to mark 30d follow-up");
        }
      }

      // ── 4. Sync Deals tab Ops status (time-based: Awaiting Wire → At Risk → Cancel Eligible) ─
      // Only sync deals still awaiting wire to avoid unnecessary API calls for completed ones.
      if (!deal.wire_received_at && !deal.payment_received_at) {
        syncDealOpsStatus({
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
        }).catch((err) =>
          logger.error({ err, dealId: deal.id }, "[Scheduler] Deals tab sync failed")
        );
      }
    }

    logger.info({ count: rows.length }, "[Scheduler] Fulfillment scheduler tick complete");
  } catch (err) {
    logger.error({ err }, "[Scheduler] Scheduler run failed (non-fatal)");
  }
}

initDb()
  .then(() => {
    logger.info("Database ready — all systems operational");
    // Start the 30-minute fulfillment scheduler
    setInterval(() => { void runScheduler(); }, 30 * 60 * 1000).unref();
  })
  .catch((err) => {
    const detail = err instanceof Error ? err.message : String(err);
    logger.error({ err }, `Database initialisation failed: ${detail} — exiting`);
    server.close(() => process.exit(1));
    setTimeout(() => process.exit(1), 5_000).unref();
  });

// ── 5. Graceful shutdown ──────────────────────────────────────────────────────
// Railway sends SIGTERM before killing the container. Waiting for in-flight
// requests to finish avoids dropped connections and mid-write data corruption.
function shutdown(signal: string) {
  logger.info({ signal }, "Shutdown signal received — draining connections");
  server.close((err) => {
    if (err) {
      logger.error({ err }, "Error during server close");
      process.exit(1);
    }
    logger.info("Server closed cleanly");
    process.exit(0);
  });
  // Force exit after 10 s in case connections don't drain
  setTimeout(() => {
    logger.warn("Graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

// ── 6. Catch unhandled rejections and exceptions ──────────────────────────────
// These are programming errors. Log them clearly and exit so Railway restarts.
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection — exiting");
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception — exiting");
  process.exit(1);
});
