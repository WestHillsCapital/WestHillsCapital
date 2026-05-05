/**
 * Docuplete — Smoke Test (step-by-step diagnostic)
 *
 * Each section is self-contained. If a step hangs, the Checkly log will
 * show the last ✅ printed, pinpointing the exact failure.
 *
 * Deliberately uses only string/regex URL patterns (never function
 * predicates) to avoid hangs in older Playwright runtimes.
 */

import { test, expect } from "@playwright/test";

const BASE     = "https://www.westhillscapital.com";
const EMAIL    = "bigej36290@lohinja.com";
const PASSWORD = "T35tacc0nt";

test("Docuplete — smoke", async ({ page, context }) => {

  // ── 0. Cookie consent (prevents banner blocking clicks) ──────────────────
  await context.addCookies([{
    name: "whc_cookie_consent", value: "granted",
    domain: "www.westhillscapital.com", path: "/",
  }]);
  console.log("✅ [0] Cookie pre-seeded");

  // ── 1. Load sign-in page ──────────────────────────────────────────────────
  await page.goto(`${BASE}/app/sign-in`, { waitUntil: "domcontentloaded" });
  console.log("✅ [1] sign-in page loaded:", page.url());

  // ── 2. Email field ────────────────────────────────────────────────────────
  const emailInput = page.locator('input[type="email"], input[name="identifier"]').first();
  await emailInput.waitFor({ state: "visible", timeout: 20000 });
  console.log("✅ [2] email input visible");

  // ── 3. Fill email → Enter ─────────────────────────────────────────────────
  await emailInput.fill(EMAIL);
  await page.keyboard.press("Enter");
  console.log("✅ [3] email entered");

  // ── 4. Password field ─────────────────────────────────────────────────────
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.waitFor({ state: "visible", timeout: 15000 });
  console.log("✅ [4] password input visible");

  // ── 5. Fill password → click submit ──────────────────────────────────────
  await passwordInput.fill(PASSWORD);
  const submitBtn = page.locator('button.cl-formButtonPrimary:not([aria-hidden="true"])').first();
  await submitBtn.waitFor({ state: "visible", timeout: 10000 });
  await submitBtn.click();
  console.log("✅ [5] submit clicked");

  // ── 6. Wait for redirect away from sign-in ────────────────────────────────
  // Uses a string glob pattern — avoids function-predicate hangs.
  await page.waitForURL("**/app/**", { timeout: 30000 });
  console.log("✅ [6] redirected to:", page.url());

  // ── 7. Confirm we are NOT on the sign-in page ─────────────────────────────
  expect(page.url()).not.toContain("sign-in");
  console.log("✅ [7] sign-in NOT in URL — authenticated");

  // ── 8. Navigate to packages ───────────────────────────────────────────────
  await page.goto(`${BASE}/app/packages`, { waitUntil: "domcontentloaded" });
  console.log("✅ [8] packages page loaded");

  // ── 9. Package Builder tab visible ───────────────────────────────────────
  await expect(
    page.getByRole("button", { name: "Package Builder", exact: true }).first()
  ).toBeVisible({ timeout: 12000 });
  console.log("✅ [9] Package Builder tab visible");

  // ── 10. Sessions page loads ───────────────────────────────────────────────
  await page.goto(`${BASE}/app/sessions`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible({ timeout: 12000 });
  console.log("✅ [10] Sessions heading visible");

  // ── 11. Settings page loads ───────────────────────────────────────────────
  await page.goto(`${BASE}/app/settings`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-nav]").first()).toBeVisible({ timeout: 12000 });
  console.log("✅ [11] Settings sidebar visible");

  console.log("\n🎉 Smoke test passed — infrastructure confirmed.");
});
