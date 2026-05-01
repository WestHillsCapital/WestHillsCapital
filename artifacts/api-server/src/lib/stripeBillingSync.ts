import { getDb } from "../db";
import { logger } from "./logger";
import { insertAuditLog } from "./auditLog";
import { getPlanLimits } from "./plans";
import { getUserEmailsToNotify, sendInAppNotifications } from "./notificationPrefs";
import { sendOrgAlertEmails } from "./email";

type StripeSubscriptionObject = {
  id: string;
  customer: string;
  status: string;
  current_period_start?: number;
  current_period_end?: number;
  items?: {
    data?: Array<{
      quantity?: number;
      price?: {
        id?: string;
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
  if (metadataTier === "starter" || metadataTier === "pro" || metadataTier === "enterprise") {
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
    const seatLimit  = limits.maxSeats === 999
      ? 999
      : limits.maxSeats + extraSeats;

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
      [planTier, sub.id, sub.status, periodStart, seatLimit, customerId],
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
          const orgName = orgRows[0]?.name ?? "Docuplete";
          const notifTitle = `Plan changed to ${planTier}`;
          const notifBody  = `Your subscription was updated from ${preAccount.plan_tier} to ${planTier}.`;
          const [emails] = await Promise.all([
            getUserEmailsToNotify(preAccount.id, "billing_plan_change"),
            sendInAppNotifications(preAccount.id, "billing_plan_change", notifTitle, notifBody),
          ]);
          await sendOrgAlertEmails({
            recipientEmails: emails,
            orgName,
            subject:   `${orgName}: plan changed to ${planTier}`,
            heading:   "Your plan has changed",
            bodyHtml:  `<p>Your Docuplete subscription has been updated from <strong>${preAccount.plan_tier}</strong> to <strong>${planTier}</strong>.</p><p>If you didn't make this change or have questions, please contact your account administrator.</p>`,
          });
        } catch (err) {
          logger.error({ err, accountId: preAccount.id }, "[BillingSync] Failed to send plan_change notification emails");
        }
      })();
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
}
