import { getStripeSync, getUncachableStripeClient } from "./stripeClient";

/**
 * Verifies a Stripe webhook signature using the raw STRIPE_WEBHOOK_SECRET env var
 * and returns the parsed event. Throws if the secret is missing or the signature
 * is invalid.
 */
export async function verifyAndParseWebhook(
  payload: Buffer,
  signature: string,
): Promise<{ type: string; data: { object: Record<string, unknown> } }> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is not configured. " +
      "Add this secret from your Stripe Dashboard → Developers → Webhooks → your endpoint → Signing secret.",
    );
  }
  const stripe = await getUncachableStripeClient();
  const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  return event as unknown as { type: string; data: { object: Record<string, unknown> } };
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "STRIPE WEBHOOK ERROR: Payload must be a Buffer. " +
        "Received type: " + typeof payload + ". " +
        "FIX: Ensure webhook route is registered BEFORE app.use(express.json()).",
      );
    }
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
  }
}
