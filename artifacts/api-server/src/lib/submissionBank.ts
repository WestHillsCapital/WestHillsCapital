import { getDb } from "../db";
import { logger } from "./logger";

export type PackSource = "one_off" | "monthly_pack" | "annual_pack";

export interface BankEntry {
  id:           number;
  remaining:    number;
  amount:       number;
  source:       PackSource;
  pack_size:    number;
  deposited_at: Date;
  expires_at:   Date;
}

export interface BankBalance {
  total:   number;
  entries: BankEntry[];
}

/**
 * Deposit submissions into an account's bank.
 * Each deposit gets its own row with an expiry date.
 */
export async function depositSubmissions(params: {
  accountId:  number;
  amount:     number;
  source:     PackSource;
  packSize:   number;
  expiresAt:  Date;
  stripeRef?: string;
}): Promise<void> {
  const db = getDb();
  await db.query(
    `INSERT INTO submission_bank
       (account_id, amount, remaining, source, pack_size, stripe_ref, expires_at)
     VALUES ($1, $2, $2, $3, $4, $5, $6)`,
    [
      params.accountId,
      params.amount,
      params.source,
      params.packSize,
      params.stripeRef ?? null,
      params.expiresAt,
    ],
  );
  logger.info(
    { accountId: params.accountId, amount: params.amount, source: params.source, expiresAt: params.expiresAt },
    "[SubmissionBank] Deposited submissions",
  );
}

/**
 * Attempt to draw one submission from the bank (oldest expiry first).
 * Returns true if a submission was drawn, false if the bank is empty.
 * Uses SELECT FOR UPDATE SKIP LOCKED for safe concurrent access.
 */
export async function drawOneFromBank(accountId: number): Promise<boolean> {
  const db = getDb();
  const { rows } = await db.query<{ id: number }>(
    `UPDATE submission_bank
        SET remaining = remaining - 1
      WHERE id = (
        SELECT id FROM submission_bank
         WHERE account_id = $1
           AND remaining  > 0
           AND expires_at > NOW()
         ORDER BY expires_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
      )
    RETURNING id`,
    [accountId],
  );
  return rows.length > 0;
}

/**
 * Returns the current bank balance for an account — total remaining
 * submissions and a breakdown by deposit entry (oldest first).
 * Expired entries are excluded.
 */
export async function getBankBalance(accountId: number): Promise<BankBalance> {
  const db = getDb();
  const { rows } = await db.query<BankEntry>(
    `SELECT id, remaining, amount, source, pack_size, deposited_at, expires_at
       FROM submission_bank
      WHERE account_id = $1
        AND remaining  > 0
        AND expires_at > NOW()
      ORDER BY expires_at ASC`,
    [accountId],
  );
  const total = rows.reduce((sum, r) => sum + r.remaining, 0);
  return { total, entries: rows };
}

/**
 * Register a recurring pack subscription so invoice.paid can deposit
 * the correct amount without an extra Stripe API call.
 */
export async function registerPackSubscription(params: {
  accountId:            number;
  stripeSubscriptionId: string;
  packSize:             number;
  packType:             "monthly" | "annual";
}): Promise<void> {
  const db = getDb();
  await db.query(
    `INSERT INTO pack_subscriptions
       (account_id, stripe_subscription_id, pack_size, pack_type)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (stripe_subscription_id) DO NOTHING`,
    [params.accountId, params.stripeSubscriptionId, params.packSize, params.packType],
  );
}

/**
 * Look up a registered pack subscription by its Stripe subscription ID.
 */
export async function getPackSubscription(stripeSubscriptionId: string): Promise<{
  accountId: number;
  packSize:  number;
  packType:  "monthly" | "annual";
} | null> {
  const db = getDb();
  const { rows } = await db.query<{
    account_id: number;
    pack_size:  number;
    pack_type:  string;
  }>(
    `SELECT account_id, pack_size, pack_type
       FROM pack_subscriptions
      WHERE stripe_subscription_id = $1`,
    [stripeSubscriptionId],
  );
  if (!rows[0]) return null;
  return {
    accountId: rows[0].account_id,
    packSize:  rows[0].pack_size,
    packType:  rows[0].pack_type as "monthly" | "annual",
  };
}

/**
 * Remove a pack subscription record when the Stripe subscription is cancelled.
 */
export async function removePackSubscription(stripeSubscriptionId: string): Promise<void> {
  const db = getDb();
  await db.query(
    `DELETE FROM pack_subscriptions WHERE stripe_subscription_id = $1`,
    [stripeSubscriptionId],
  );
}
