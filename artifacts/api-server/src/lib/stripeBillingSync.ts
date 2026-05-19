import { getDb } from "../db";
import { logger } from "./logger";
import { insertAuditLog } from "./auditLog";
import { getPlanLimits, getPlanDisplayName } from "./plans";
import { getUserEmailsToNotify, sendInAppNotifications } from "./notificationPrefs";
import { sendOrgAlertEmails } from "./email";
import {
  depositSubmissions,
  registerPackSubscription,
  getPackSubscription,
  removePackSubscription,
} from "./submissionBank";
import {
  depositGenerations,
  registerGenPackSubscription,
  getGenPackSubscription,
  removeGenPackSubscription,
} from "./generationBank";

type StripeSubscriptionObject = {
  id: string;
  customer: string;
  status: string;
  metadata?: Record<string, string> | null;
  current_period_start?: number;
  current_period_end?: number;
  items?: {
    data?: Array<{
      quantity?: number;
      price?: {
        id?: string;
        product?: string;
        unit_amount?: number;
        recurring?: { interval?: string; interval_count?: number };
      };
    }>;
  };
};

type StripeInvoiceObject = {
  id: string;
  customer: string;
  subscription?: string | null;
  status?: string;
  paid?: boolean;
  amount_paid?: number;
};

type StripeDisputeObject = {
  id: string;
  charge: string;
  amount: number;
  currency: string;
  payment_intent?: string | null;
};

type StripeCheckoutSession = {
  id:           string;
  mode:         string;
  customer?:    string | null;
  subscription?: string | null;
  payment_intent?: string | null;
  metadata?:    Record<string, string> | null;
};

type StripeEvent = {
  type: string;
  data: { object: Record<string, unknown> };
};

/**
 * Maps a Stripe subscription status + product metadata to a Docuplete plan tier.
 * Falls through to "free" when the subscription is cancelled or past due.
 */
function resolveSubscriptionPlanTier(
  status: string,
  metadataTier: string | null | undefined,
): string {
  if (status !== "active" && status !== "trialing") {
    return "free";
  }
  if (metadataTier === "starter" || metadataTier === "pro" || metadataTier === "developer" || metadataTier === "enterprise") {
    return metadataTier;
  }
  return "starter"; // default paid tier
}

/**
 * Returns the total number of extra seats purchased as add-ons in this subscription.
 * Checks subscription items against STRIPE_EXTRA_SEAT_*_PRICE_ID env vars.
 */
function resolveExtraSeats(items: StripeSubscriptionObject["items"]): number {
  const seatPriceIds = new Set(
    [
      process.env.STRIPE_EXTRA_SEAT_MONTHLY_PRICE_ID,
      process.env.STRIPE_EXTRA_SEAT_ANNUAL_PRICE_ID,
    ].filter(Boolean) as string[],
  );
  if (seatPriceIds.size === 0) return 0;
  let total = 0;
  for (const item of items?.data ?? []) {
    if (item.price?.id && seatPriceIds.has(item.price.id)) {
      total += item.quantity ?? 0;
    }
  }
  return total;
}

/**
 * Updates the accounts table from a Stripe subscription or invoice event.
 * Called from the webhook handler in app.ts after StripeSync processes the event.
 */
export async function handleStripeSubscriptionEvent(event: StripeEvent): Promise<void> {
  const db = getDb();

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object as StripeSubscriptionObject;
    const customerId = sub.customer;
    if (!customerId) return;

    // Look up which plan tier this subscription is for via product metadata
    let metadataTier: string | null = null;
    try {
      const productId = sub.items?.data?.[0]?.price?.product ?? null;
      if (productId) {
        const { rows } = await db.query<{ metadata: Record<string, string> | null }>(
          `SELECT metadata FROM stripe.products WHERE id = $1`,
          [productId],
        );
        metadataTier = rows[0]?.metadata?.plan_tier ?? null;
      }
    } catch {
      // stripe schema not available yet — skip product lookup
    }

    const planTier   = resolveSubscriptionPlanTier(sub.status, metadataTier);
    const limits     = getPlanLimits(planTier);
    const extraSeats = resolveExtraSeats(sub.items);
    const seatLimit  = limits.maxSeats + extraSeats;

    const periodStart = sub.current_period_start
      ? new Date(sub.current_period_start * 1000)
      : null;

    // Fetch account id + current plan tier before the update so we can write a meaningful audit entry
    const { rows: preRows } = await db.query<{ id: number; plan_tier: string; subscription_status: string | null }>(
      `SELECT id, plan_tier, subscription_status FROM accounts WHERE stripe_customer_id = $1`,
      [customerId],
    );
    const preAccount = preRows[0] ?? null;
    const prevStatus = preAccount?.subscription_status ?? null;

    await db.query(
      `UPDATE accounts
          SET plan_tier              = $1,
              stripe_subscription_id = $2,
              subscription_status    = $3,
              billing_period_start   = $4,
              seat_limit             = $5,
              trial_ended_at = CASE
                WHEN $3 = 'active' THEN NULL
                WHEN $6 = 'trialing' AND $3 NOT IN ('active', 'trialing') THEN NOW()
                ELSE trial_ended_at
              END
        WHERE stripe_customer_id    = $7`,
      [planTier, sub.id, sub.status, periodStart, seatLimit, prevStatus, customerId],
    );

    logger.info(
      { customerId, planTier, subscriptionStatus: sub.status, subscriptionId: sub.id },
      "[BillingSync] Account plan updated from subscription event",
    );

    if (preAccount && preAccount.plan_tier !== planTier) {
      void insertAuditLog({
        accountId:     preAccount.id,
        actorEmail:    null,
        actorUserId:   null,
        action:        "plan.change",
        resourceType:  "subscription",
        resourceId:    sub.id,
        resourceLabel: planTier,
        metadata: {
          from_plan:  preAccount.plan_tier,
          to_plan:    planTier,
          status:     sub.status,
          event_type: event.type,
        },
      });

      // Notify org members who want billing_plan_change notifications
      void (async () => {
        try {
          const { rows: orgRows } = await db.query<{ name: string }>(
            `SELECT name FROM accounts WHERE id = $1`,
            [preAccount.id],
          );
          const orgName    = orgRows[0]?.name ?? "Docuplete";
          const fromLabel  = getPlanDisplayName(preAccount.plan_tier);
          const toLabel    = getPlanDisplayName(planTier);
          const isDowngradeToFree = planTier === "free";

          const notifTitle = isDowngradeToFree
            ? "Your subscription has ended"
            : `Plan changed to ${toLabel}`;
          const notifBody = isDowngradeToFree
            ? `Your ${fromLabel} subscription has ended. Your account has been moved to the Free plan (1 package, 3 submissions/month).`
            : `Your subscription was updated from ${fromLabel} to ${toLabel}.`;

          const [emails] = await Promise.all([
            getUserEmailsToNotify(preAccount.id, "billing_plan_change"),
            sendInAppNotifications(preAccount.id, "billing_plan_change", notifTitle, notifBody),
          ]);

          if (isDowngradeToFree) {
            await sendOrgAlertEmails({
              recipientEmails: emails,
              orgName,
              subject:  `${orgName}: your ${fromLabel} subscription has ended`,
              heading:  "Your subscription has ended",
              bodyHtml: `<p>Your <strong>${fromLabel}</strong> subscription has ended and your account has been moved to the <strong>Free plan</strong>.</p><p>On the Free plan you have access to 1 package and up to 3 submissions per month. To restore full access, <a href="${(process.env.FRONTEND_URL ?? "").replace(/\/$/, "")}/app/settings#billing-section">upgrade your plan</a>.</p><p>If you believe this is an error, please contact your account administrator.</p>`,
              ctaUrl:  `${(process.env.FRONTEND_URL ?? "").replace(/\/$/, "")}/app/settings#billing-section`,
              ctaText: "Upgrade Plan",
            });
          } else {
            await sendOrgAlertEmails({
              recipientEmails: emails,
              orgName,
              subject:  `${orgName}: plan changed to ${toLabel}`,
              heading:  "Your plan has changed",
              bodyHtml: `<p>Your Docuplete subscription has been updated from <strong>${fromLabel}</strong> to <strong>${toLabel}</strong>.</p><p>If you didn't make this change or have questions, please contact your account administrator.</p>`,
            });
          }
        } catch (err) {
          logger.error({ err, accountId: preAccount.id }, "[BillingSync] Failed to send plan_change notification emails");
        }
      })();
    }

    // ── Affiliate referral creation (new subscriptions with a referral code) ────
    if (event.type === "customer.subscription.created" && sub.metadata?.referral_code) {
      const referralCode = sub.metadata.referral_code;
      try {
        const { rows: affRows } = await db.query<{
          id: number; commission_rate: string; commission_months: number;
        }>(
          `SELECT id, commission_rate, commission_months FROM affiliates WHERE referral_code = $1 AND status IN ('approved', 'active')`,
          [referralCode],
        );
        const aff = affRows[0];
        if (aff) {
          const priceItem  = sub.items?.data?.[0];
          const interval   = priceItem?.price?.recurring?.interval ?? "month";
          const unitAmount = priceItem?.price?.unit_amount ?? 0;
          const planType   = interval === "year" ? "annual" : "monthly";
          const monthlyAmt = planType === "annual" ? Math.round(unitAmount / 12) : unitAmount;
          const commCents  = Math.round(monthlyAmt * parseFloat(aff.commission_rate));

          const { rows: refRows } = await db.query<{ id: number }>(
            `INSERT INTO affiliate_referrals
               (affiliate_id, stripe_customer_id, stripe_subscription_id, plan_type, monthly_amount_cents, commission_months_total)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (stripe_subscription_id) DO NOTHING
             RETURNING id`,
            [aff.id, sub.customer, sub.id, planType, monthlyAmt, aff.commission_months],
          );
          const referralId = refRows[0]?.id;

          if (referralId && planType === "annual" && commCents > 0) {
            const now = new Date();
            const inserts = Array.from({ length: aff.commission_months }, (_, i) => {
              const dueDate = new Date(now);
              dueDate.setMonth(dueDate.getMonth() + i + 1);
              const periodLabel = dueDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
              return db.query(
                `INSERT INTO affiliate_commissions
                   (affiliate_id, referral_id, amount_cents, status, due_date, period_label)
                 VALUES ($1, $2, $3, 'pending', $4, $5)`,
                [aff.id, referralId, commCents, dueDate, periodLabel],
              );
            });
            await Promise.all(inserts);
            logger.info({ affiliateId: aff.id, referralId, commCents, months: aff.commission_months }, "[BillingSync] Annual affiliate referral + commissions created");
          } else if (referralId) {
            logger.info({ affiliateId: aff.id, referralId, planType }, "[BillingSync] Monthly affiliate referral created");
          }

          await db.query(
            `UPDATE affiliates SET status = 'active', updated_at = NOW() WHERE id = $1 AND status = 'approved'`,
            [aff.id],
          );
        }
      } catch (refErr) {
        logger.error({ err: refErr }, "[BillingSync] Non-fatal: failed to create affiliate referral");
      }
    }

    return;
  }

  if (event.type === "invoice.paid") {
    const inv = event.data.object as StripeInvoiceObject;
    if (!inv.subscription || !inv.customer) return;

    // Mark subscription active and clear trial_ended_at so the purge job
    // does not reprocess this account. data_purged_at is intentionally kept
    // immutable once set — it is an audit record. The route guard checks
    // subscription_status to allow active accounts through regardless.
    await db.query(
      `UPDATE accounts
          SET subscription_status = 'active',
              trial_ended_at      = NULL
        WHERE stripe_customer_id  = $1`,
      [inv.customer],
    );
    logger.info({ customerId: inv.customer }, "[BillingSync] Subscription marked active on invoice.paid");

    // Deposit recurring pack submissions if this invoice is for a submission pack subscription
    const packSub = await getPackSubscription(inv.subscription);
    if (packSub) {
      const depositAmount = packSub.packType === "annual"
        ? packSub.packSize * 12
        : packSub.packSize;
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      await depositSubmissions({
        accountId:  packSub.accountId,
        amount:     depositAmount,
        source:     packSub.packType === "annual" ? "annual_pack" : "monthly_pack",
        packSize:   packSub.packSize,
        stripeRef:  inv.subscription,
        expiresAt,
      });
    }

    // Deposit recurring generation credits if this invoice is for a gen pack subscription
    const genPackSub = await getGenPackSubscription(inv.subscription);
    if (genPackSub) {
      const depositAmount = genPackSub.packType === "annual"
        ? genPackSub.packSize * 12
        : genPackSub.packSize;
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      await depositGenerations({
        accountId:  genPackSub.accountId,
        amount:     depositAmount,
        source:     genPackSub.packType === "annual" ? "annual_pack" : "monthly_pack",
        packSize:   genPackSub.packSize,
        stripeRef:  inv.subscription,
        expiresAt,
      });
    }

    // ── Monthly affiliate commission ──────────────────────────────────────────
    if (inv.subscription) {
      try {
        const { rows: refRows } = await db.query<{
          id: number; affiliate_id: number; monthly_amount_cents: number;
          commission_months_total: number; commission_months_paid: number;
          plan_type: string;
        }>(
          `SELECT * FROM affiliate_referrals WHERE stripe_subscription_id = $1 AND status = 'active' AND plan_type = 'monthly'`,
          [inv.subscription],
        );
        const ref = refRows[0];
        if (ref && ref.commission_months_paid < ref.commission_months_total) {
          const { rows: affRows } = await db.query<{ commission_rate: string }>(
            `SELECT commission_rate FROM affiliates WHERE id = $1`, [ref.affiliate_id],
          );
          const rate      = parseFloat(affRows[0]?.commission_rate ?? "0.2");
          const commCents = Math.round(ref.monthly_amount_cents * rate);
          const now       = new Date();
          const month     = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
          await db.query(
            `INSERT INTO affiliate_commissions
               (affiliate_id, referral_id, amount_cents, status, due_date, period_label, stripe_invoice_id)
             VALUES ($1, $2, $3, 'pending', NOW(), $4, $5)
             ON CONFLICT (stripe_invoice_id) DO NOTHING`,
            [ref.affiliate_id, ref.id, commCents, month, inv.id],
          );
          const newPaid   = ref.commission_months_paid + 1;
          const newStatus = newPaid >= ref.commission_months_total ? "completed" : "active";
          await db.query(
            `UPDATE affiliate_referrals SET commission_months_paid = $1, status = $2, updated_at = NOW() WHERE id = $3`,
            [newPaid, newStatus, ref.id],
          );
          logger.info({ affiliateId: ref.affiliate_id, referralId: ref.id, commCents, newPaid }, "[BillingSync] Monthly affiliate commission created");
        }
      } catch (commErr) {
        logger.error({ err: commErr }, "[BillingSync] Non-fatal: failed to create monthly affiliate commission");
      }
    }

    return;
  }

  if (event.type === "invoice.payment_failed") {
    const inv = event.data.object as StripeInvoiceObject;
    if (!inv.customer) return;
    const { rows: failedAccRows } = await db.query<{ id: number; name: string }>(
      `UPDATE accounts SET subscription_status = 'past_due'
        WHERE stripe_customer_id = $1
        RETURNING id, name`,
      [inv.customer],
    );
    const failedAcc = failedAccRows[0] ?? null;
    logger.warn({ customerId: inv.customer }, "[BillingSync] Subscription marked past_due on invoice.payment_failed");

    // Notify org members who want billing_payment_failed notifications
    if (failedAcc) {
      void (async () => {
        try {
          const orgName = failedAcc.name ?? "Docuplete";
          const [emails] = await Promise.all([
            getUserEmailsToNotify(failedAcc.id, "billing_payment_failed"),
            sendInAppNotifications(
              failedAcc.id,
              "billing_payment_failed",
              "Payment failed",
              "A payment attempt failed. Please update your billing information.",
            ),
          ]);
          await sendOrgAlertEmails({
            recipientEmails: emails,
            orgName,
            subject:  "Action required: payment failed on your Docuplete subscription",
            heading:  "Payment failed",
            bodyHtml: `<p>A payment attempt for your Docuplete subscription was unsuccessful. Your account has been marked as past due.</p><p>Please update your billing information to restore full access.</p>`,
          });
        } catch (err) {
          logger.error({ err, accountId: failedAcc.id }, "[BillingSync] Failed to send payment_failed notification emails");
        }
      })();
    }

    return;
  }

  // ── Pack purchase: one-off (mode=payment) ───────────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as StripeCheckoutSession;
    const meta = session.metadata ?? {};

    // ── Generation pack (Developer plan) ──────────────────────────────────────
    if (meta.type === "gen_pack_purchase" || meta.type === "gen_pack_subscription") {
      const accountId = meta.account_id ? parseInt(meta.account_id, 10) : null;
      const packSize  = meta.pack_size  ? parseInt(meta.pack_size,  10) : null;
      const packType  = meta.pack_type  ?? null;
      if (!accountId || !packSize || !packType) return;

      if (session.mode === "payment") {
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        await depositGenerations({
          accountId,
          amount:    packSize,
          source:    "one_off",
          packSize,
          stripeRef: session.payment_intent ?? session.id,
          expiresAt,
        });
        logger.info({ accountId, packSize }, "[BillingSync] One-off generation pack deposited");
      } else if (session.mode === "subscription" && session.subscription) {
        await registerGenPackSubscription({
          accountId,
          stripeSubscriptionId: session.subscription,
          packSize,
          packType: packType as "monthly" | "annual",
        });
        logger.info({ accountId, packSize, packType, subId: session.subscription }, "[BillingSync] Generation pack subscription registered");
      }
      return;
    }

    // ── Submission pack (Starter / Pro) ───────────────────────────────────────
    if (meta.type !== "pack_purchase" && meta.type !== "pack_subscription") return;

    const accountId = meta.account_id ? parseInt(meta.account_id, 10) : null;
    const packSize  = meta.pack_size  ? parseInt(meta.pack_size,  10) : null;
    const packType  = meta.pack_type  ?? null;
    if (!accountId || !packSize || !packType) return;

    if (session.mode === "payment") {
      // One-off: deposit immediately
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      await depositSubmissions({
        accountId,
        amount:    packSize,
        source:    "one_off",
        packSize,
        stripeRef: session.payment_intent ?? session.id,
        expiresAt,
      });
      logger.info({ accountId, packSize }, "[BillingSync] One-off pack deposited");
    } else if (session.mode === "subscription" && session.subscription) {
      // Recurring: register the subscription so invoice.paid can deposit
      await registerPackSubscription({
        accountId,
        stripeSubscriptionId: session.subscription,
        packSize,
        packType: packType as "monthly" | "annual",
      });
      logger.info({ accountId, packSize, packType, subId: session.subscription }, "[BillingSync] Pack subscription registered");
    }
    return;
  }

  // ── Pack subscription cancelled ─────────────────────────────────────────────
  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as StripeSubscriptionObject;
    if (sub.id) {
      await removePackSubscription(sub.id);
      await removeGenPackSubscription(sub.id); // no-op if not a gen pack subscription
    }
    return;
  }

  // ── Charge dispute: log for admin review ─────────────────────────────────────
  if (event.type === "charge.dispute.created") {
    const dispute = event.data.object as StripeDisputeObject;
    logger.warn(
      { disputeId: dispute.id, charge: dispute.charge, amount: dispute.amount },
      "[BillingSync] Dispute created — admin should review and manually cancel affiliate commissions for this customer",
    );
    return;
  }
}
