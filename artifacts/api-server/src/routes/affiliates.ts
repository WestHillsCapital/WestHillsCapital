import { Router } from "express";
import { randomBytes } from "crypto";
import { getDb } from "../db";
import { logger } from "../lib/logger";
import { getUncachableStripeClient } from "../lib/stripeClient";
import { z } from "zod";

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateReferralCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

function formatPeriodLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ── Types ─────────────────────────────────────────────────────────────────────

const AffiliateApplySchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(300),
  company: z.string().max(200).optional(),
  website: z.string().url().max(500).optional().or(z.literal("")),
  message: z.string().min(10).max(2000),
});

const AffiliateInviteSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(300),
  company: z.string().max(200).optional(),
  website: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

const AffiliatePatchSchema = z.object({
  status: z.enum(["pending", "approved", "active", "suspended"]).optional(),
  notes: z.string().max(2000).optional(),
  commissionRate: z.number().min(0).max(1).optional(),
  commissionMonths: z.number().int().min(1).max(24).optional(),
});

// ── Public router (no auth) ───────────────────────────────────────────────────

export const publicAffiliateRouter = Router();

publicAffiliateRouter.post("/apply", async (req, res) => {
  const parse = AffiliateApplySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request", issues: parse.error.issues.map(i => i.message) });
    return;
  }
  const { name, email, company, website, message } = parse.data;
  const db = getDb();

  try {
    const { rows: existing } = await db.query<{ id: number }>(
      `SELECT id FROM affiliates WHERE email = $1`,
      [email.toLowerCase()],
    );
    if (existing.length > 0) {
      res.status(409).json({ error: "An application with this email address already exists." });
      return;
    }

    const referralCode = generateReferralCode();
    await db.query(
      `INSERT INTO affiliates (name, email, company, website, referral_code, status, notes)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)`,
      [name, email.toLowerCase(), company ?? null, website ?? null, referralCode, message],
    );

    logger.info({ email }, "[Affiliates] New affiliate application submitted");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[Affiliates] Failed to submit application");
    res.status(500).json({ error: "Failed to submit application. Please try again." });
  }
});

// ── Admin router (protected by requireInternalAuth in routes/index.ts) ────────

const router = Router();
export default router;

// GET / — list all affiliates with summary stats
router.get("/", async (req, res) => {
  const db = getDb();
  try {
    const { rows } = await db.query<{
      id: number; name: string; email: string; company: string | null;
      referral_code: string; status: string; stripe_account_id: string | null;
      stripe_account_status: string | null; commission_rate: string;
      commission_months: number; created_at: string;
      referral_count: string; pending_cents: string; paid_cents: string;
    }>(`
      SELECT
        a.id, a.name, a.email, a.company, a.referral_code, a.status,
        a.stripe_account_id, a.stripe_account_status,
        a.commission_rate, a.commission_months, a.created_at,
        COUNT(DISTINCT ar.id)                                      AS referral_count,
        COALESCE(SUM(ac.amount_cents) FILTER (WHERE ac.status = 'pending'), 0) AS pending_cents,
        COALESCE(SUM(ac.amount_cents) FILTER (WHERE ac.status = 'paid'),    0) AS paid_cents
      FROM affiliates a
      LEFT JOIN affiliate_referrals ar ON ar.affiliate_id = a.id
      LEFT JOIN affiliate_commissions ac ON ac.affiliate_id = a.id
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `);
    res.json({ affiliates: rows });
  } catch (err) {
    logger.error({ err }, "[Affiliates] Failed to list affiliates");
    res.status(500).json({ error: "Failed to load affiliates." });
  }
});

// POST / — invite a new affiliate
router.post("/", async (req, res) => {
  const parse = AffiliateInviteSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request", issues: parse.error.issues.map(i => i.message) });
    return;
  }
  const { name, email, company, website, notes } = parse.data;
  const db = getDb();
  try {
    const { rows: existing } = await db.query<{ id: number }>(
      `SELECT id FROM affiliates WHERE email = $1`,
      [email.toLowerCase()],
    );
    if (existing.length > 0) {
      res.status(409).json({ error: "An affiliate with this email already exists." });
      return;
    }

    const referralCode = generateReferralCode();
    const invitedBy = req.internalEmail ?? null;

    const { rows } = await db.query<{ id: number; referral_code: string }>(
      `INSERT INTO affiliates (name, email, company, website, referral_code, status, invited_by_user_id, notes)
       VALUES ($1, $2, $3, $4, $5, 'approved', $6, $7)
       RETURNING id, referral_code`,
      [name, email.toLowerCase(), company ?? null, website ?? null, referralCode, invitedBy, notes ?? null],
    );

    logger.info({ email, invitedBy }, "[Affiliates] Affiliate invited by admin");
    res.json({ affiliate: rows[0] });
  } catch (err) {
    logger.error({ err }, "[Affiliates] Failed to invite affiliate");
    res.status(500).json({ error: "Failed to create affiliate." });
  }
});

// GET /:id — get affiliate details
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const db = getDb();
  try {
    const { rows } = await db.query<{
      id: number; name: string; email: string; company: string | null; website: string | null;
      referral_code: string; status: string; stripe_account_id: string | null;
      stripe_account_status: string | null; commission_rate: string;
      commission_months: number; invited_by_user_id: string | null;
      notes: string | null; created_at: string; updated_at: string;
    }>(`SELECT * FROM affiliates WHERE id = $1`, [id]);
    if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }

    const { rows: referrals } = await db.query(
      `SELECT ar.*,
              COALESCE(SUM(ac.amount_cents) FILTER (WHERE ac.status = 'pending'), 0) AS pending_cents,
              COALESCE(SUM(ac.amount_cents) FILTER (WHERE ac.status = 'paid'),    0) AS paid_cents,
              COUNT(ac.id) AS commission_count
         FROM affiliate_referrals ar
         LEFT JOIN affiliate_commissions ac ON ac.referral_id = ar.id
        WHERE ar.affiliate_id = $1
        GROUP BY ar.id
        ORDER BY ar.created_at DESC`,
      [id],
    );

    res.json({ affiliate: rows[0], referrals });
  } catch (err) {
    logger.error({ err }, "[Affiliates] Failed to get affiliate");
    res.status(500).json({ error: "Failed to load affiliate." });
  }
});

// PATCH /:id — update status / notes / commission params
router.patch("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const parse = AffiliatePatchSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request", issues: parse.error.issues.map(i => i.message) });
    return;
  }
  const db = getDb();
  try {
    const setClauses: string[] = ["updated_at = NOW()"];
    const values: unknown[] = [];
    let i = 1;

    if (parse.data.status !== undefined) { setClauses.push(`status = $${i++}`); values.push(parse.data.status); }
    if (parse.data.notes !== undefined) { setClauses.push(`notes = $${i++}`); values.push(parse.data.notes); }
    if (parse.data.commissionRate !== undefined) { setClauses.push(`commission_rate = $${i++}`); values.push(parse.data.commissionRate.toFixed(4)); }
    if (parse.data.commissionMonths !== undefined) { setClauses.push(`commission_months = $${i++}`); values.push(parse.data.commissionMonths); }

    values.push(id);
    const { rows } = await db.query<{ id: number; status: string }>(
      `UPDATE affiliates SET ${setClauses.join(", ")} WHERE id = $${i} RETURNING id, status`,
      values,
    );
    if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ affiliate: rows[0] });
  } catch (err) {
    logger.error({ err }, "[Affiliates] Failed to update affiliate");
    res.status(500).json({ error: "Failed to update affiliate." });
  }
});

// POST /:id/connect — create (or refresh) Stripe Connect Express account + return onboarding URL
router.post("/:id/connect", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const db = getDb();
  try {
    const { rows } = await db.query<{
      id: number; name: string; email: string; status: string;
      stripe_account_id: string | null;
    }>(`SELECT id, name, email, status, stripe_account_id FROM affiliates WHERE id = $1`, [id]);
    const affiliate = rows[0];
    if (!affiliate) { res.status(404).json({ error: "Not found" }); return; }
    if (affiliate.status === "pending") {
      res.status(400).json({ error: "Affiliate must be approved before connecting Stripe." });
      return;
    }

    const stripe = await getUncachableStripeClient();
    let stripeAccountId = affiliate.stripe_account_id;

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: affiliate.email,
        capabilities: { transfers: { requested: true } },
        business_profile: { name: affiliate.name },
        settings: { payouts: { schedule: { interval: "manual" } } },
      });
      stripeAccountId = account.id;
      await db.query(
        `UPDATE affiliates SET stripe_account_id = $1, stripe_account_status = 'pending_onboarding', updated_at = NOW() WHERE id = $2`,
        [stripeAccountId, id],
      );
    }

    const origin = process.env.APP_ORIGIN ?? "https://app.docuplete.com";
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${origin}/internal/super-admin`,
      return_url:  `${origin}/internal/super-admin`,
      type: "account_onboarding",
    });

    logger.info({ affiliateId: id, stripeAccountId }, "[Affiliates] Stripe Connect onboarding link created");
    res.json({ url: accountLink.url, stripe_account_id: stripeAccountId });
  } catch (err) {
    logger.error({ err }, "[Affiliates] Failed to create Stripe Connect link");
    const msg = err instanceof Error ? err.message : null;
    res.status(500).json({ error: msg ? `Stripe error: ${msg}` : "Failed to create Stripe Connect link." });
  }
});

// GET /:id/commissions — list all commissions for an affiliate
router.get("/:id/commissions", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const db = getDb();
  try {
    const { rows } = await db.query(`
      SELECT ac.*, ar.stripe_subscription_id, ar.plan_type, ar.monthly_amount_cents
        FROM affiliate_commissions ac
        JOIN affiliate_referrals ar ON ar.id = ac.referral_id
       WHERE ac.affiliate_id = $1
       ORDER BY ac.due_date ASC NULLS LAST, ac.created_at ASC
    `, [id]);
    res.json({ commissions: rows });
  } catch (err) {
    logger.error({ err }, "[Affiliates] Failed to list commissions");
    res.status(500).json({ error: "Failed to load commissions." });
  }
});

// POST /:id/commissions/:commissionId/pay — pay a pending commission via Stripe Transfer
router.post("/:id/commissions/:commissionId/pay", async (req, res) => {
  const affiliateId   = parseInt(req.params.id, 10);
  const commissionId  = parseInt(req.params.commissionId, 10);
  if (!affiliateId || !commissionId) { res.status(400).json({ error: "Invalid id" }); return; }
  const db = getDb();
  try {
    const { rows: affRows } = await db.query<{
      stripe_account_id: string | null; stripe_account_status: string | null; name: string;
    }>(`SELECT stripe_account_id, stripe_account_status, name FROM affiliates WHERE id = $1`, [affiliateId]);
    const affiliate = affRows[0];
    if (!affiliate) { res.status(404).json({ error: "Affiliate not found" }); return; }
    if (!affiliate.stripe_account_id) {
      res.status(400).json({ error: "Affiliate has not completed Stripe Connect onboarding." });
      return;
    }

    const { rows: commRows } = await db.query<{
      id: number; amount_cents: number; status: string; period_label: string | null;
    }>(`SELECT id, amount_cents, status, period_label FROM affiliate_commissions WHERE id = $1 AND affiliate_id = $2`, [commissionId, affiliateId]);
    const commission = commRows[0];
    if (!commission) { res.status(404).json({ error: "Commission not found" }); return; }
    if (commission.status !== "pending") {
      res.status(400).json({ error: `Commission is already ${commission.status}.` });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const transfer = await stripe.transfers.create({
      amount:      commission.amount_cents,
      currency:    "usd",
      destination: affiliate.stripe_account_id,
      description: `Docuplete affiliate commission — ${commission.period_label ?? "payout"} — ${affiliate.name}`,
    });

    await db.query(
      `UPDATE affiliate_commissions
          SET status = 'paid', paid_at = NOW(), stripe_transfer_id = $1
        WHERE id = $2`,
      [transfer.id, commissionId],
    );

    logger.info({ affiliateId, commissionId, transferId: transfer.id, amount: commission.amount_cents }, "[Affiliates] Commission paid via Stripe Transfer");
    res.json({ ok: true, transfer_id: transfer.id });
  } catch (err) {
    logger.error({ err }, "[Affiliates] Failed to pay commission");
    const msg = err instanceof Error ? err.message : null;
    res.status(500).json({ error: msg ? `Stripe error: ${msg}` : "Failed to process payment." });
  }
});
