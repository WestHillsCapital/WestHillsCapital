import { getDb } from "../db";
import { logger } from "./logger";
import { insertAuditLog } from "./auditLog";
import { PLAN_LIMITS } from "./plans";

type StripeSubscriptionObject = {
  id: string;
  customer: string;
  status: string;
  current_period_start?: number;
  current_period_end?: number;
  items?: {
    data?: Array<{
      price?: {
        product?: string;
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
  if (metadataTier === "pro" || metadataTier === "enterprise") {
    return metadataTier;
  }
  return "pro"; // default paid tier
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

    const planTier = resolveSubscriptionPlanTier(sub.status, metadataTier);
    const limits   = PLAN_LIMITS[planTier as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free;

    const periodStart = sub.current_period_start
      ? new Date(sub.current_period_start * 1000)
      : null;

    // Fetch account id + current plan tier before the update so we can write a meaningful audit entry
    const { rows: preRows } = await db.query<{ id: number; plan_tier: string }>(
      `SELECT id, plan_tier FROM accounts WHERE stripe_customer_id = $1`,
      [customerId],
    );
    const preAccount = preRows[0] ?? null;

    await db.query(
      `UPDATE accounts
          SET plan_tier              = $1,
              stripe_subscription_id = $2,
              subscription_status    = $3,
              billing_period_start   = $4,
              seat_limit             = $5
        WHERE stripe_customer_id    = $6`,
      [planTier, sub.id, sub.status, periodStart, limits.maxSeats, customerId],
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
    }

    return;
  }

  if (event.type === "invoice.paid") {
    const inv = event.data.object as StripeInvoiceObject;
    if (!inv.subscription || !inv.customer) return;
    // Subscription paid — ensure status reflects active
    await db.query(
      `UPDATE accounts SET subscription_status = 'active' WHERE stripe_customer_id = $1`,
      [inv.customer],
    );
    logger.info({ customerId: inv.customer }, "[BillingSync] Subscription marked active on invoice.paid");
    return;
  }

  if (event.type === "invoice.payment_failed") {
    const inv = event.data.object as StripeInvoiceObject;
    if (!inv.customer) return;
    await db.query(
      `UPDATE accounts SET subscription_status = 'past_due' WHERE stripe_customer_id = $1`,
      [inv.customer],
    );
    logger.warn({ customerId: inv.customer }, "[BillingSync] Subscription marked past_due on invoice.payment_failed");
    return;
  }
}
