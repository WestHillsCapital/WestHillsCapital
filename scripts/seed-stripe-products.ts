/**
 * Script: seed-stripe-products.ts
 *
 * Creates / updates Docuplete subscription products in Stripe.
 * For each plan:
 *   - If the product doesn't exist → create product + price
 *   - If the product exists but no price matches the target amount
 *       → create a new price and archive old prices for that product
 *   - If the product + correct price already exist → skip
 *
 * Usage:
 *   pnpm --filter @workspace/api-server exec tsx ../../scripts/seed-stripe-products.ts
 */
import { getUncachableStripeClient } from "../artifacts/api-server/src/lib/stripeClient.ts";
import type Stripe from "stripe";

const PLANS = [
  {
    name: "Docuplete Starter",
    tier: "starter",
    amount: 6900,
    currency: "usd",
    interval: "month" as const,
    description: "2 seats · 50 packages · 200 submissions/month · eSign + PDF filling",
  },
  {
    name: "Docuplete Pro",
    tier: "pro",
    amount: 24900,
    currency: "usd",
    interval: "month" as const,
    description: "5 seats · Unlimited packages · 500 submissions/month · eSign + PDF filling",
  },
  {
    name: "Docuplete Developer",
    tier: "developer",
    amount: 49900,
    currency: "usd",
    interval: "month" as const,
    description: "10 seats · Unlimited packages · API access · Programmatic PDF generation",
  },
  {
    name: "Docuplete Enterprise",
    tier: "enterprise",
    amount: 300000,
    currency: "usd",
    interval: "month" as const,
    description: "Unlimited seats · Unlimited packages · Unlimited submissions · SSO + SLA",
  },
] as const;

async function run() {
  const stripe = await getUncachableStripeClient();

  for (const plan of PLANS) {
    // Find existing active product by plan_tier metadata
    const existing = await stripe.products.search({
      query: `metadata['plan_tier']:'${plan.tier}' AND active:'true'`,
    });

    let product: Stripe.Product;

    if (existing.data.length > 0) {
      product = existing.data[0];
      console.log(`[found]    Product: ${product.name} (${product.id})`);

      // Update name/description if needed
      if (product.name !== plan.name || product.description !== plan.description) {
        product = await stripe.products.update(product.id, {
          name: plan.name,
          description: plan.description,
        });
        console.log(`[updated]  Product name/description → ${plan.name}`);
      }
    } else {
      product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
        metadata: { plan_tier: plan.tier },
      });
      console.log(`[created]  Product: ${plan.name} (${product.id})`);
    }

    // List all active recurring prices for this product
    const prices = await stripe.prices.list({
      product: product.id,
      active: true,
      recurring: { interval: plan.interval },
      limit: 20,
    });

    const matchingPrice = prices.data.find((p) => p.unit_amount === plan.amount);

    if (matchingPrice) {
      console.log(`[skip]     Price $${plan.amount / 100}/${plan.interval} already exists (${matchingPrice.id})`);
      console.log(`           STRIPE_${plan.tier.toUpperCase()}_PRICE_ID=${matchingPrice.id}`);
      continue;
    }

    // Archive any old prices that don't match
    for (const oldPrice of prices.data) {
      await stripe.prices.update(oldPrice.id, { active: false });
      console.log(`[archived] Old price $${(oldPrice.unit_amount ?? 0) / 100}/${plan.interval} (${oldPrice.id})`);
    }

    // Create the new price
    const newPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.amount,
      currency: plan.currency,
      recurring: { interval: plan.interval },
    });

    console.log(`[created]  Price $${plan.amount / 100}/${plan.interval} (${newPrice.id})`);
    console.log(`           STRIPE_${plan.tier.toUpperCase()}_PRICE_ID=${newPrice.id}`);
  }

  console.log("\nDone.");
}

run().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
