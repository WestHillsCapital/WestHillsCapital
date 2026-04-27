import { createClerkClient } from "@clerk/express";
import { getDb } from "../db";
import { logger } from "./logger";

/**
 * Attempts to link a pending team invitation to a Clerk user on their first sign-in.
 *
 * Looks up the user's primary email from Clerk, then finds any account_users row
 * with status='pending' and the same email (case-insensitive). If found, the row
 * is promoted to status='active' and clerk_user_id is written.
 *
 * Returns the linked row on success, or null if no pending invitation exists.
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

    // Use a CTE to target exactly one pending invite row (the most recently
    // sent one) so we avoid updating across multiple accounts if the same
    // email address has more than one pending invitation.
    const result = await getDb().query<{ account_id: number; role: string; email: string }>(
      `WITH target AS (
         SELECT id FROM account_users
          WHERE lower(email) = lower($2)
            AND status       = 'pending'
            AND clerk_user_id IS NULL
          ORDER BY invited_at DESC NULLS LAST
          LIMIT 1
       )
       UPDATE account_users
          SET clerk_user_id = $1,
              status        = 'active',
              last_seen_at  = NOW(),
              display_name  = COALESCE(display_name, $3)
        WHERE id = (SELECT id FROM target)
        RETURNING account_id, role, email`,
      [clerkUserId, primaryEmail, displayName],
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
