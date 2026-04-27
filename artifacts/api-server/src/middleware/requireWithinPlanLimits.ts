import type { Request, Response, NextFunction } from "express";
import { getDb } from "../db";
import { getPlanLimits } from "../lib/plans";
import { logger } from "../lib/logger";

export type LimitedResource = "package" | "submission";

function currentPeriodStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Middleware that checks whether the account is within its plan limits
 * before allowing the creation of a package or the start of an interview session.
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
      }>(
        `SELECT plan_tier, seat_limit FROM accounts WHERE id = $1`,
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
        const period = currentPeriodStart();
        const { rows } = await db.query<{ count: string }>(
          `SELECT COUNT(*) AS count FROM usage_events
           WHERE account_id = $1 AND event_type = 'submission' AND period_start = $2`,
          [accountId, period],
        );
        const current = parseInt(rows[0]?.count ?? "0", 10);
        if (current >= limits.maxSubmissionsPerMonth) {
          res.status(402).json({
            error: `Your plan allows up to ${limits.maxSubmissionsPerMonth} submissions per month. Upgrade to continue.`,
            upgrade_required: true,
            limit_type: "submissions",
            current,
            limit: limits.maxSubmissionsPerMonth,
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
    const period = currentPeriodStart();
    await db.query(
      `INSERT INTO usage_events (account_id, event_type, period_start)
       VALUES ($1, 'submission', $2)`,
      [accountId, period],
    );
  } catch (err) {
    logger.error({ err, accountId }, "[PlanLimits] Failed to record submission event");
  }
}
