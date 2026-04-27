import type { Request, Response, NextFunction } from "express";
import { getDb } from "../db";
import { getPlanLimits } from "../lib/plans";
import { logger } from "../lib/logger";

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
 * Records a submission usage event for the given account.
 * Call after a session is successfully created (fire-and-forget is acceptable).
 */
export async function recordSubmissionEvent(accountId: number): Promise<void> {
  await recordUsageEvent(accountId, "submission");
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
