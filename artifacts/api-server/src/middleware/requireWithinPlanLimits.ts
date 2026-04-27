import type { Request, Response, NextFunction } from "express";
import { getDb } from "../db";
import { getPlanLimits } from "../lib/plans";
import { logger } from "../lib/logger";

export type LimitedResource = "package" | "submission" | "seat";

/**
 * Returns the billing-period start date string for an account.
 *
 * If the account has a known `billing_period_start` (set by Stripe webhook on
 * subscription creation), we use that date's day-of-month to compute the
 * most-recent period boundary so that usage windows align with the Stripe
 * billing cycle.  Falls back to the first of the calendar month for free /
 * unsubscribed accounts.
 */
function billingPeriodStart(billingPeriodStartDate: Date | null): string {
  const now = new Date();

  if (billingPeriodStartDate) {
    const anchorDay = billingPeriodStartDate.getUTCDate();
    // Determine if the anchor day has passed this month
    const thisMonthAnchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), anchorDay));
    const periodStart = thisMonthAnchor <= now
      ? thisMonthAnchor
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, anchorDay));
    const y = periodStart.getUTCFullYear();
    const m = String(periodStart.getUTCMonth() + 1).padStart(2, "0");
    const d = String(periodStart.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Default: first of the calendar month
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
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
      logger.error({ err, accountId, resource }, "[PlanLimits] Error checking plan limits");
      next();
    }
  };
}

/**
 * Records a submission usage event for the given account.
 * Call after a session is successfully created (fire-and-forget is acceptable).
 */
export async function recordSubmissionEvent(accountId: number): Promise<void> {
  try {
    const db = getDb();
    await db.query(
      `INSERT INTO usage_events (account_id, event_type) VALUES ($1, 'submission')`,
      [accountId],
    );
  } catch (err) {
    logger.error({ err, accountId }, "[PlanLimits] Failed to record submission event");
  }
}
