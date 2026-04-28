import type { Request, Response, NextFunction } from "express";
import { getDb } from "../db";
import { getPlanLimits } from "../lib/plans";
import { logger } from "../lib/logger";
import { getUserEmailsToNotify, sendInAppNotifications } from "../lib/notificationPrefs";
import { sendOrgAlertEmails } from "../lib/email";

export type LimitedResource = "package" | "submission" | "seat";

function utcDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function toDateString(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Returns the billing-period start date string for an account.
 *
 * If the account has a known `billing_period_start` (set by Stripe webhook on
 * subscription creation), we use that date's day-of-month to compute the
 * most-recent period boundary so that usage windows align with the Stripe
 * billing cycle.
 *
 * The anchor day is clamped to the last valid day of the target month to match
 * Stripe's behavior for anchors of 29–31 in shorter months (e.g. a March 31
 * anchor falls on Feb 28/29 in February).
 *
 * Falls back to the first of the calendar month for free / unsubscribed accounts.
 */
function billingPeriodStart(billingPeriodStartDate: Date | null): string {
  const now = new Date();

  if (billingPeriodStartDate) {
    const rawAnchor = billingPeriodStartDate.getUTCDate();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();

    const thisAnchorDay = Math.min(rawAnchor, utcDaysInMonth(y, m));
    const thisMonthAnchor = new Date(Date.UTC(y, m, thisAnchorDay));

    if (thisMonthAnchor <= now) {
      return toDateString(thisMonthAnchor);
    }
    // Anchor hasn't passed yet — use previous month
    const prevYear  = m === 0 ? y - 1 : y;
    const prevMonth = m === 0 ? 11 : m - 1;
    const prevAnchorDay = Math.min(rawAnchor, utcDaysInMonth(prevYear, prevMonth));
    return toDateString(new Date(Date.UTC(prevYear, prevMonth, prevAnchorDay)));
  }

  // Default: first of the calendar month (UTC to stay consistent with anchor logic above)
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Middleware that checks whether the account is within its plan limits
 * before allowing the creation of a package, an interview session, or a seat.
 *
 * Returns 402 with upgrade_required: true when the limit is breached.
 * Internal users (req.internalEmail) always bypass limits.
 */
export function requireWithinPlanLimits(resource: LimitedResource) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Internal portal users have no limits
    if (req.internalEmail) {
      next();
      return;
    }

    const accountId = req.internalAccountId;
    if (!accountId) {
      res.status(401).json({ error: "Account not resolved." });
      return;
    }

    try {
      const db = getDb();

      const { rows: acctRows } = await db.query<{
        plan_tier: string;
        seat_limit: number;
        billing_period_start: Date | null;
      }>(
        `SELECT plan_tier, seat_limit, billing_period_start FROM accounts WHERE id = $1`,
        [accountId],
      );

      const account = acctRows[0];
      if (!account) {
        res.status(404).json({ error: "Account not found." });
        return;
      }

      const limits = getPlanLimits(account.plan_tier);

      if (resource === "package") {
        if (limits.maxPackages === null) {
          next();
          return;
        }
        const { rows } = await db.query<{ count: string }>(
          `SELECT COUNT(*) AS count FROM docufill_packages WHERE account_id = $1`,
          [accountId],
        );
        const current = parseInt(rows[0]?.count ?? "0", 10);
        if (current >= limits.maxPackages) {
          res.status(402).json({
            error: `Your plan allows up to ${limits.maxPackages} package${limits.maxPackages !== 1 ? "s" : ""}. Upgrade to create more.`,
            upgrade_required: true,
            limit_type: "packages",
            current,
            limit: limits.maxPackages,
          });
          return;
        }
      }

      if (resource === "submission") {
        if (limits.maxSubmissionsPerMonth === null) {
          next();
          return;
        }
        // Use the account's billing-period window (not a fixed calendar month)
        const period = billingPeriodStart(account.billing_period_start);
        const { rows } = await db.query<{ count: string }>(
          `SELECT COUNT(*) AS count FROM usage_events
           WHERE account_id = $1
             AND event_type = 'submission'
             AND created_at >= $2::date`,
          [accountId, period],
        );
        const current = parseInt(rows[0]?.count ?? "0", 10);
        if (current >= limits.maxSubmissionsPerMonth) {
          res.status(402).json({
            error: `Your plan allows up to ${limits.maxSubmissionsPerMonth} submissions per billing period. Upgrade to continue.`,
            upgrade_required: true,
            limit_type: "submissions",
            current,
            limit: limits.maxSubmissionsPerMonth,
          });
          return;
        }
      }

      if (resource === "seat") {
        const { rows } = await db.query<{ count: string }>(
          `SELECT COUNT(*) AS count FROM account_users
           WHERE account_id = $1 AND status <> 'pending'`,
          [accountId],
        );
        const current = parseInt(rows[0]?.count ?? "0", 10);
        if (current >= limits.maxSeats) {
          res.status(402).json({
            error: `Your plan allows up to ${limits.maxSeats} active seat${limits.maxSeats !== 1 ? "s" : ""}. Upgrade to add more team members.`,
            upgrade_required: true,
            limit_type: "seats",
            current,
            limit: limits.maxSeats,
          });
          return;
        }
      }

      next();
    } catch (err) {
      logger.error({ err, accountId, resource }, "[PlanLimits] Error checking plan limits — failing closed");
      res.status(503).json({
        error: "Unable to verify plan limits. Please try again in a moment.",
        retryable: true,
      });
    }
  };
}

/**
 * Returns the absolute URL for the billing/upgrade settings page.
 * Uses FRONTEND_URL env var (same convention used throughout the API server,
 * e.g. in lib/google-sheets.ts). Falls back to an empty base so the link is
 * still a valid relative path in the worst case.
 */
function upgradeUrl(): string {
  const base = (process.env.FRONTEND_URL ?? "").replace(/\/$/, "");
  return `${base}/app/settings#billing-section`;
}

/**
 * Attempt to record a threshold alert in the plan_limit_alerts deduplication
 * table. Returns true if the row was inserted (alert should be sent), or false
 * if it already exists (duplicate — skip sending).
 */
async function tryClaimAlert(
  accountId: number,
  period: string,
  thresholdPct: number,
): Promise<boolean> {
  const db = getDb();
  try {
    const result = await db.query(
      `INSERT INTO plan_limit_alerts (account_id, billing_period_start, threshold_pct)
       VALUES ($1, $2::date, $3)
       ON CONFLICT (account_id, billing_period_start, threshold_pct) DO NOTHING`,
      [accountId, period, thresholdPct],
    );
    return (result.rowCount ?? 0) > 0;
  } catch (err) {
    logger.error({ err, accountId, period, thresholdPct }, "[PlanLimits] tryClaimAlert failed — skipping duplicate check");
    return false;
  }
}

/**
 * Records a submission usage event for the given account.
 * After recording, fires a plan_limit_warning notification when usage crosses
 * the 80% or 90% threshold for the first time in the billing period.
 * Duplicate alerts within the same billing period are suppressed via the
 * plan_limit_alerts deduplication table.
 * Call after a session is successfully created (fire-and-forget is acceptable).
 */
export async function recordSubmissionEvent(accountId: number): Promise<void> {
  await recordUsageEvent(accountId, "submission");

  // Check if usage just crossed a warning threshold and notify opted-in members
  void (async () => {
    try {
      const db = getDb();
      const { rows: acctRows } = await db.query<{
        plan_tier: string;
        name: string;
        billing_period_start: Date | null;
      }>(
        `SELECT plan_tier, name, billing_period_start FROM accounts WHERE id = $1`,
        [accountId],
      );
      const acct = acctRows[0];
      if (!acct) return;

      const limits = getPlanLimits(acct.plan_tier);
      const maxSubs = limits.maxSubmissionsPerMonth;
      if (maxSubs === null) return; // unlimited plan

      const period = billingPeriodStart(acct.billing_period_start);
      const { rows: countRows } = await db.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM usage_events
          WHERE account_id = $1 AND event_type = 'submission' AND created_at >= $2::date`,
        [accountId, period],
      );
      const used = parseInt(countRows[0]?.count ?? "0", 10);

      const threshold80 = Math.floor(maxSubs * 0.8);
      const threshold90 = Math.floor(maxSubs * 0.9);

      // Determine which threshold band we're in (prefer the higher one).
      // Using >= range checks so batch submissions that skip the exact count
      // still trigger the alert.
      let thresholdPct: number | null = null;
      if (threshold90 !== threshold80 && used >= threshold90) thresholdPct = 90;
      else if (used >= threshold80) thresholdPct = 80;
      if (thresholdPct === null) return;

      // Deduplication: only send once per billing period per threshold level.
      const claimed = await tryClaimAlert(accountId, period, thresholdPct);
      if (!claimed) return;

      const pctLabel = `${thresholdPct}%`;
      const orgName = acct.name ?? "Docuplete";
      const notifTitle = `${pctLabel} of submission limit used`;
      const notifBody  = `Your organization has used ${used} of ${maxSubs} submissions this billing period.`;
      const upgradeLink = upgradeUrl();
      const [emails] = await Promise.all([
        getUserEmailsToNotify(accountId, "plan_limit_warning"),
        sendInAppNotifications(accountId, "plan_limit_warning", notifTitle, notifBody),
      ]);
      await sendOrgAlertEmails({
        recipientEmails: emails,
        orgName,
        subject:  `${orgName}: you've used ${pctLabel} of your monthly submission limit`,
        heading:  `${pctLabel} of your submission limit used`,
        bodyHtml: `<p>Your organization has used <strong>${used} of ${maxSubs}</strong> interview submissions allowed this billing period (${pctLabel}).</p><p>If you're approaching your limit, consider upgrading your plan to avoid interruption to your workflow.</p>`,
        ctaUrl:   upgradeLink,
        ctaText:  "Upgrade Plan",
      });
      logger.info({ accountId, used, maxSubs, thresholdPct }, "[PlanLimits] Sent plan_limit_warning notification");
    } catch (err) {
      logger.error({ err, accountId }, "[PlanLimits] Failed to check/send plan_limit_warning");
    }
  })();
}

/**
 * Records a PDF generation usage event for the given account.
 * Call after a packet is successfully generated and the response sent.
 */
export async function recordPdfGenerationEvent(accountId: number): Promise<void> {
  await recordUsageEvent(accountId, "pdf_generation");
}

async function recordUsageEvent(accountId: number, eventType: string): Promise<void> {
  try {
    const db = getDb();
    await db.query(
      `INSERT INTO usage_events (account_id, event_type) VALUES ($1, $2)`,
      [accountId, eventType],
    );
  } catch (err) {
    logger.error({ err, accountId, eventType }, "[PlanLimits] Failed to record usage event");
  }
}
