import { getDb } from "../db";
import { logger } from "./logger";

export type GenPackSource = "one_off" | "monthly_pack" | "annual_pack";

export interface GenBankEntry {
  id:           number;
  remaining:    number;
  amount:       number;
  source:       GenPackSource;
  pack_size:    number;
  deposited_at: Date;
  expires_at:   Date;
}

export interface GenBankBalance {
  total:   number;
  entries: GenBankEntry[];
}

/**
 * Deposit generations into an account's generation bank.
 * Each deposit gets its own row with an expiry date.
 */
export async function depositGenerations(params: {
  accountId:  number;
  amount:     number;
  source:     GenPackSource;
  packSize:   number;
  expiresAt:  Date;
  stripeRef?: string;
}): Promise<void> {
  const db = getDb();
  await db.query(
    `INSERT INTO generation_bank
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
    "[GenerationBank] Deposited generations",
  );
}

/**
 * Attempt to draw one generation from the bank (oldest expiry first).
 * Returns true if a generation was drawn, false if the bank is empty.
 * Uses SELECT FOR UPDATE SKIP LOCKED for safe concurrent access.
 */
export async function drawOneFromGenBank(accountId: number): Promise<boolean> {
  const db = getDb();
  const { rows } = await db.query<{ id: number }>(
    `UPDATE generation_bank
        SET remaining = remaining - 1
      WHERE id = (
        SELECT id FROM generation_bank
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
 * Returns the current generation bank balance for an account — total remaining
 * generations and a breakdown by deposit entry (oldest first).
 * Expired entries are excluded.
 */
export async function getGenBankBalance(accountId: number): Promise<GenBankBalance> {
  const db = getDb();
  const { rows } = await db.query<GenBankEntry>(
    `SELECT id, remaining, amount, source, pack_size, deposited_at, expires_at
       FROM generation_bank
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
 * Register a recurring generation pack subscription so invoice.paid can deposit
 * the correct amount without an extra Stripe API call.
 */
export async function registerGenPackSubscription(params: {
  accountId:            number;
  stripeSubscriptionId: string;
  packSize:             number;
  packType:             "monthly" | "annual";
}): Promise<void> {
  const db = getDb();
  await db.query(
    `INSERT INTO generation_pack_subscriptions
       (account_id, stripe_subscription_id, pack_size, pack_type)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (stripe_subscription_id) DO NOTHING`,
    [params.accountId, params.stripeSubscriptionId, params.packSize, params.packType],
  );
}

/**
 * Look up a registered generation pack subscription by its Stripe subscription ID.
 */
export async function getGenPackSubscription(stripeSubscriptionId: string): Promise<{
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
       FROM generation_pack_subscriptions
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
 * Remove a generation pack subscription record when the Stripe subscription is cancelled.
 */
export async function removeGenPackSubscription(stripeSubscriptionId: string): Promise<void> {
  const db = getDb();
  await db.query(
    `DELETE FROM generation_pack_subscriptions WHERE stripe_subscription_id = $1`,
    [stripeSubscriptionId],
  );
}
