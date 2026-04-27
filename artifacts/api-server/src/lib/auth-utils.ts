import { createClerkClient } from "@clerk/express";
import { getDb } from "../db";
import { logger } from "./logger";
import { getPlanLimits } from "./plans";

/**
 * Attempts to link a pending team invitation to a Clerk user on their first sign-in.
 *
 * Looks up the user's primary email from Clerk, then finds any account_users row
 * with status='pending' and the same email (case-insensitive). If found, and the
 * account still has room under its plan's seat cap, the row is promoted to
 * status='active' and clerk_user_id is written.
 *
 * Returns the linked row on success, or null if no pending invitation exists or
 * the account is at its seat limit.
 */
export async function linkPendingInvitation(
  clerkUserId: string,
): Promise<{ account_id: number; role: string; email: string } | null> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return null;

  try {
    const clerk = createClerkClient({ secretKey });
    const clerkUser = await clerk.users.getUser(clerkUserId);
    const primaryEmail = (
      clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
      ?? clerkUser.emailAddresses[0]
    )?.emailAddress;
    const displayName =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;

    if (!primaryEmail) return null;

    // Find the pending invite (read-only — most-recent by invited_at)
    const findResult = await getDb().query<{
      id: number;
      account_id: number;
      role: string;
      email: string;
    }>(
      `SELECT id, account_id, role, email
         FROM account_users
        WHERE lower(email) = lower($1)
          AND status       = 'pending'
          AND clerk_user_id IS NULL
        ORDER BY invited_at DESC NULLS LAST
        LIMIT 1`,
      [primaryEmail],
    );

    if (!findResult.rows[0]) return null;
    const invite = findResult.rows[0];

    // Enforce the account's seat limit before activating the invite
    const { rows: limitRows } = await getDb().query<{
      plan_tier: string;
      active_seats: string;
    }>(
      `SELECT a.plan_tier,
              COUNT(au.id) FILTER (WHERE au.status = 'active') AS active_seats
         FROM accounts a
         LEFT JOIN account_users au ON au.account_id = a.id
        WHERE a.id = $1
        GROUP BY a.id, a.plan_tier`,
      [invite.account_id],
    );

    const planTier   = limitRows[0]?.plan_tier ?? "free";
    const activeSeats = parseInt(limitRows[0]?.active_seats ?? "0", 10);
    const limits     = getPlanLimits(planTier);

    if (activeSeats >= limits.maxSeats) {
      logger.warn(
        { accountId: invite.account_id, planTier, activeSeats, maxSeats: limits.maxSeats, email: primaryEmail },
        "[Auth] Seat limit reached — cannot activate invited user",
      );
      return null;
    }

    // Promote to active
    const result = await getDb().query<{ account_id: number; role: string; email: string }>(
      `UPDATE account_users
          SET clerk_user_id = $1,
              status        = 'active',
              last_seen_at  = NOW(),
              display_name  = COALESCE(display_name, $2)
        WHERE id     = $3
          AND status = 'pending'
        RETURNING account_id, role, email`,
      [clerkUserId, displayName, invite.id],
    );

    if (result.rows[0]) {
      logger.info(
        { clerkUserId, email: primaryEmail },
        "[Auth] Linked pending invitation on first sign-in",
      );
      return result.rows[0];
    }
    return null;
  } catch (err) {
    logger.warn({ err }, "[Auth] Could not look up Clerk user for invitation linking");
    return null;
  }
}
