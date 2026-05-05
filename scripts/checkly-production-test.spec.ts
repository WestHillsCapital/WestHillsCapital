/**
 * Docuplete — Smoke Test
 *
 * Every operation has an explicit timeout so no single step can block
 * the whole run. page.setDefaultTimeout / setDefaultNavigationTimeout
 * is set to 30 s immediately to override any Checkly-level default.
 */

import { test, expect } from "@playwright/test";

const BASE     = "https://www.westhillscapital.com";
const EMAIL    = "bigej36290@lohinja.com";
const PASSWORD = "T35tacc0nt";

test("Docuplete — smoke", async ({ page, context }) => {

  // Cap every operation at 30 s — overrides whatever Checkly sets globally
  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(30_000);

  // ── 0. Cookie consent ─────────────────────────────────────────────────────
  await context.addCookies([{
    name: "whc_cookie_consent", value: "granted",
    domain: "www.westhillscapital.com", path: "/",
  }]);
  console.log("✅ [0] cookie seeded");

  // ── 1. Load sign-in page ──────────────────────────────────────────────────
  await page.goto(`${BASE}/app/sign-in`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  console.log("✅ [1] sign-in page:", page.url());

  // ── 2. Email input visible ────────────────────────────────────────────────
  const emailInput = page.locator('input[type="email"], input[name="identifier"]').first();
  await emailInput.waitFor({ state: "visible", timeout: 20_000 });
  console.log("✅ [2] email input visible");

  // ── 3. Enter email ────────────────────────────────────────────────────────
  await emailInput.fill(EMAIL);
  await page.keyboard.press("Enter");
  console.log("✅ [3] email submitted");

  // ── 4. Password input visible ─────────────────────────────────────────────
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.waitFor({ state: "visible", timeout: 15_000 });
  console.log("✅ [4] password input visible");

  // ── 5. Submit ─────────────────────────────────────────────────────────────
  await passwordInput.fill(PASSWORD);
  const submitBtn = page.locator('button.cl-formButtonPrimary:not([aria-hidden="true"])').first();
  await submitBtn.waitFor({ state: "visible", timeout: 10_000 });
  await submitBtn.click();
  console.log("✅ [5] submit clicked");

  // ── 6. Redirect away from sign-in ─────────────────────────────────────────
  // Use RegExp — avoids glob-pattern matching edge cases
  await page.waitForURL(/\/app(?!\/sign-in)/, { timeout: 30_000 });
  console.log("✅ [6] redirected to:", page.url());

  // ── 7. Confirm authenticated ──────────────────────────────────────────────
  expect(page.url()).not.toContain("sign-in");
  console.log("✅ [7] authenticated");

  // ── 8. Packages page ──────────────────────────────────────────────────────
  await page.goto(`${BASE}/app/packages`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await expect(
    page.getByRole("button", { name: "Package Builder", exact: true }).first()
  ).toBeVisible({ timeout: 12_000 });
  console.log("✅ [8] packages page + tab visible");

  // ── 9. Sessions page ──────────────────────────────────────────────────────
  await page.goto(`${BASE}/app/sessions`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible({ timeout: 12_000 });
  console.log("✅ [9] sessions page visible");

  // ── 10. Settings page ─────────────────────────────────────────────────────
  await page.goto(`${BASE}/app/settings`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await expect(page.locator("[data-nav]").first()).toBeVisible({ timeout: 12_000 });
  console.log("✅ [10] settings sidebar visible");

  console.log("\n🎉 Smoke test passed.");
});
