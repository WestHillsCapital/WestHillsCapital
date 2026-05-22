/**
 * seed-products.ts
 *
 * Creates (or verifies) all Docuplete products and prices in Stripe.
 * Idempotent — skips creation if a product with matching metadata already exists.
 *
 * Run: pnpm --filter @workspace/scripts exec tsx src/seed-products.ts
 */

import { getStripeClient } from "./stripeClient.js";

// ── Authoritative pricing (matches lib/plan-data/src/index.ts) ───────────────
const PLANS = [
  {
    tier:        "starter",
    name:        "Starter",
    description: "Up to 5 packages · 150 sessions/mo · 2 seats included",
    monthlyUsd:  69,
    annualUsd:   660,   // $55/mo × 12 (20% off)
  },
  {
    tier:        "pro",
    name:        "Pro",
    description: "Unlimited packages · 400 sessions/mo · 10 seats included",
    monthlyUsd:  249,
    annualUsd:   2_388, // $199/mo × 12 (20% off)
  },
  {
    tier:        "developer",
    name:        "Developer",
    description: "API access · 500 PDF generations/mo · Org-wide seats",
    monthlyUsd:  499,
    annualUsd:   4_788, // $399/mo × 12 (20% off)
  },
  {
    tier:        "enterprise",
    name:        "Enterprise",
    description: "Unlimited everything · 25 seats · SSO/SAML/SCIM",
    monthlyUsd:  3_000,
    annualUsd:   28_800, // $2,400/mo × 12 (20% off)
  },
] as const;

const ADDONS = [
  {
    key:         "extra_seat",
    name:        "Extra Seat",
    description: "Additional seat for Starter, Pro, or Enterprise plans",
    monthlyUsd:  15,
    annualUsd:   144,  // $12/mo × 12 (20% off)
  },
  {
    key:         "extra_submission_pack",
    name:        "Extra Session Pack (50 sessions)",
    description: "50 additional sessions per billing period",
    monthlyUsd:  25,
    annualUsd:   240,  // $20/mo × 12 (20% off)
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────

async function findOrCreateProduct(
  stripe: Awaited<ReturnType<typeof getStripeClient>>,
  metadata: Record<string, string>,
  name: string,
  description: string,
): Promise<string> {
  // Check for existing product by metadata key
  const metaKey = Object.keys(metadata)[0];
  const metaVal = metadata[metaKey];
  const existing = await stripe.products.search({
    query: `metadata["${metaKey}"]:"${metaVal}" AND active:"true"`,
  });
  if (existing.data.length > 0) {
    const p = existing.data[0];
    console.log(`  ✓ Product already exists: ${p.name} (${p.id})`);
    return p.id;
  }

  const product = await stripe.products.create({ name, description, metadata });
  console.log(`  + Created product: ${product.name} (${product.id})`);
  return product.id;
}

async function findOrCreatePrice(
  stripe: Awaited<ReturnType<typeof getStripeClient>>,
  productId: string,
  interval: "month" | "year",
  amountCents: number,
  nickname: string,
): Promise<string> {
  const existing = await stripe.prices.list({
    product: productId,
    active:  true,
    type:    "recurring",
    limit:   20,
  });
  const match = existing.data.find((p) => p.recurring?.interval === interval);
  if (match) {
    console.log(`    ✓ Price already exists: ${match.nickname ?? match.id} (${match.id})`);
    return match.id;
  }

  const price = await stripe.prices.create({
    product:   productId,
    currency:  "usd",
    unit_amount: amountCents,
    recurring: { interval },
    nickname,
  });
  console.log(`    + Created price: ${price.nickname} (${price.id})`);
  return price.id;
}

async function main() {
  const stripe = await getStripeClient();
  console.log("Connected to Stripe.\n");

  const ids: Record<string, string> = {};

  // ── Plan products ───────────────────────────────────────────────────────────
  console.log("=== Plan Products ===");
  for (const plan of PLANS) {
    console.log(`\n[${plan.tier}]`);
    const productId = await findOrCreateProduct(
      stripe,
      { plan_tier: plan.tier },
      plan.name,
      plan.description,
    );

    const monthlyId = await findOrCreatePrice(
      stripe, productId, "month", plan.monthlyUsd * 100,
      `${plan.name} — Monthly`,
    );
    const annualId = await findOrCreatePrice(
      stripe, productId, "year", plan.annualUsd * 100,
      `${plan.name} — Annual`,
    );

    ids[`STRIPE_${plan.tier.toUpperCase()}_MONTHLY_PRICE_ID`] = monthlyId;
    ids[`STRIPE_${plan.tier.toUpperCase()}_ANNUAL_PRICE_ID`]  = annualId;
  }

  // ── Add-on products ─────────────────────────────────────────────────────────
  console.log("\n=== Add-on Products ===");
  for (const addon of ADDONS) {
    console.log(`\n[${addon.key}]`);
    const productId = await findOrCreateProduct(
      stripe,
      { addon_type: addon.key },
      addon.name,
      addon.description,
    );

    const monthlyId = await findOrCreatePrice(
      stripe, productId, "month", addon.monthlyUsd * 100,
      `${addon.name} — Monthly`,
    );
    const annualId = await findOrCreatePrice(
      stripe, productId, "year", addon.annualUsd * 100,
      `${addon.name} — Annual`,
    );

    ids[`STRIPE_EXTRA_${addon.key === "extra_seat" ? "SEAT" : "SUBMISSION"}_MONTHLY_PRICE_ID`] = monthlyId;
    ids[`STRIPE_EXTRA_${addon.key === "extra_seat" ? "SEAT" : "SUBMISSION"}_ANNUAL_PRICE_ID`]  = annualId;
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log("\n=== Env Vars (set these in Railway for the API server) ===");
  for (const [key, val] of Object.entries(ids)) {
    console.log(`${key}=${val}`);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
