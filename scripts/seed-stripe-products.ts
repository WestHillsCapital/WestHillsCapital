/**
 * Script: seed-stripe-products.ts
 *
 * Creates Docuplete Pro and Enterprise products + monthly prices in Stripe.
 * Idempotent — safe to run multiple times (skips existing products).
 *
 * Usage:
 *   pnpm --filter @workspace/api-server exec tsx ../../scripts/seed-stripe-products.ts
 */
import { getUncachableStripeClient } from "../artifacts/api-server/src/lib/stripeClient.ts";

const PLANS = [
  {
    name:      "Docuplete Pro",
    tier:      "pro",
    amount:    9900,
    currency:  "usd",
    interval:  "month" as const,
    description: "Unlimited packages · 500 submissions/month · 5 seats",
  },
  {
    name:      "Docuplete Enterprise",
    tier:      "enterprise",
    amount:    29900,
    currency:  "usd",
    interval:  "month" as const,
    description: "Unlimited packages · Unlimited submissions · Unlimited seats",
  },
] as const;

async function run() {
  const stripe = await getUncachableStripeClient();

  for (const plan of PLANS) {
    // Check if product already exists
    const existing = await stripe.products.search({
      query: `metadata['plan_tier']:'${plan.tier}' AND active:'true'`,
    });

    if (existing.data.length > 0) {
      console.log(`[skip] ${plan.name} already exists (${existing.data[0].id})`);
      continue;
    }

    const product = await stripe.products.create({
      name:        plan.name,
      description: plan.description,
      metadata:    { plan_tier: plan.tier },
    });
    console.log(`[created] Product: ${product.name} (${product.id})`);

    const price = await stripe.prices.create({
      product:   product.id,
      unit_amount: plan.amount,
      currency:  plan.currency,
      recurring: { interval: plan.interval },
    });
    console.log(`[created] Price: $${plan.amount / 100}/${plan.interval} (${price.id})`);
    console.log(`          STRIPE_${plan.tier.toUpperCase()}_PRICE_ID=${price.id}`);
  }

  console.log("\nDone. Set the STRIPE_PRO_PRICE_ID and STRIPE_ENTERPRISE_PRICE_ID env vars");
  console.log("if you want Checkout to work before stripe-replit-sync backfill runs.");
}

run().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
