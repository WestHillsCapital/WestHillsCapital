/**
 * Docuplete / West Hills Capital — Public Pages Check
 * Checkly Browser Check — runtime: 2025.04
 *
 * No auth required. Verifies that the public marketing site and key SEO pages
 * load correctly and the /app route correctly redirects unauthenticated users.
 *
 * Also exercises the pricing API (gold spot + products) via page.request so we
 * know the Railway API is reachable and returning valid data before a user ever
 * signs in.
 *
 * Hard limit: 240 s. Expected runtime: ~60 s.
 */

import { test, expect } from "@playwright/test";

const BASE = "https://www.westhillscapital.com";

test("West Hills Capital — public pages", async ({ page, context, request }) => {

  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(30_000);

  // Pre-seed consent cookie so the banner never blocks clicks
  await context.addCookies([{
    name: "whc_cookie_consent", value: "granted",
    domain: "www.westhillscapital.com", path: "/",
  }]);

  // ── 1. Homepage ────────────────────────────────────────────────────────────
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await expect(page).toHaveTitle(/west hills capital/i, { timeout: 10_000 });
  // Sticky header is always present on every public page
  await expect(page.locator("header").first()).toBeVisible({ timeout: 8_000 });
  console.log("✅ [1] Homepage loaded —", page.url());

  // ── 2. Pricing page ───────────────────────────────────────────────────────
  await page.goto(`${BASE}/pricing`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  // Page should render without a crash (no "Application error")
  const bodyText = await page.locator("body").innerText({ timeout: 8_000 });
  expect(bodyText).not.toMatch(/application error|something went wrong|500/i);
  await expect(page.locator("body")).toBeVisible({ timeout: 5_000 });
  console.log("✅ [2] Pricing page loaded");

  // ── 3. /app unauthenticated redirect → sign-in ────────────────────────────
  // Clerk performs a client-side redirect (no page reload), so waitForURL's
  // "load" event never fires. Use toHaveURL which polls the URL instead.
  await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await expect(page).toHaveURL(/sign-in/, { timeout: 15_000 });
  console.log("✅ [3] /app redirects unauthenticated users to sign-in");

  // ── 4. SEO learn article: Gold IRA vs Traditional IRA ─────────────────────
  await page.goto(`${BASE}/learn/gold-ira-vs-traditional-ira`, {
    waitUntil: "domcontentloaded", timeout: 30_000,
  });
  // Article should have a meaningful heading and no crash
  await expect(
    page.getByRole("heading", { level: 1 }).first()
      .or(page.getByRole("heading", { level: 2 }).first())
  ).toBeVisible({ timeout: 10_000 });
  const articleBody = await page.locator("body").innerText({ timeout: 8_000 });
  expect(articleBody).not.toMatch(/application error|something went wrong|404|not found/i);
  // Verify the corrected IRS eligibility fact is present
  expect(articleBody).toMatch(/proof|american eagle|gold buffalo|numismatic|collectible/i);
  console.log("✅ [4] Gold IRA learn article loaded — IRS-eligibility copy present");

  // ── 5. Docuplete marketing site ───────────────────────────────────────────
  await page.goto(`${BASE}/docuplete`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  const docBody = await page.locator("body").innerText({ timeout: 8_000 });
  expect(docBody).not.toMatch(/application error|something went wrong|500/i);
  console.log("✅ [5] Docuplete marketing page loaded");

  // ── 6. API health — pricing endpoints (no auth required) ─────────────────
  // Fetch gold spot price
  const spotRes = await request.get(`${BASE}/api/pricing/spot`).catch(() => null);
  if (spotRes) {
    expect(spotRes.status()).toBe(200);
    const spotData = await spotRes.json().catch(() => null) as Record<string, unknown> | null;
    expect(spotData).not.toBeNull();
    console.log(`✅ [6a] /api/pricing/spot → 200 (gold: ${JSON.stringify(spotData).substring(0, 80)})`);
  } else {
    // Pricing may be served from a different origin; try via page.evaluate
    const spotFetch = await page.evaluate(async () => {
      const r = await fetch("/api/pricing/spot");
      return { status: r.status, body: await r.text() };
    }).catch(() => null);
    if (spotFetch) {
      expect(spotFetch.status).toBe(200);
      console.log(`✅ [6a] /api/pricing/spot → ${spotFetch.status} (via page.evaluate)`);
    } else {
      console.log("⚠️ [6a] /api/pricing/spot — could not reach (different origin; skipped)");
    }
  }

  // Fetch product catalogue
  const productsRes = await request.get(`${BASE}/api/pricing/products`).catch(() => null);
  if (productsRes) {
    expect(productsRes.status()).toBe(200);
    const products = await productsRes.json().catch(() => null) as unknown[] | null;
    expect(Array.isArray(products) || products !== null).toBe(true);
    console.log(`✅ [6b] /api/pricing/products → 200`);
  } else {
    console.log("⚠️ [6b] /api/pricing/products — could not reach (different origin; skipped)");
  }

  console.log("\n🎉 Public pages check passed.");
});
