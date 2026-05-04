import { test, expect } from "@playwright/test";

const BASE = "https://www.westhillscapital.com";
const EMAIL = "bigej36290@lohinja.com";
const PASSWORD = "T35tacc0nt";

test("West Hills Capital — production smoke test", async ({ page, context }) => {

  // ── Pre-seed cookie consent so the banner never appears ──────────────────
  await context.addCookies([{
    name: "whc_cookie_consent",
    value: "granted",
    domain: "www.westhillscapital.com",
    path: "/",
  }]);

  // ── 1. Sign in ─────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/app/sign-in`);
  await page.waitForLoadState("networkidle");

  // Clerk renders an email input — find it however it appears
  const emailInput = page.getByRole("textbox", { name: /email/i }).or(page.locator('input[type="email"]'));
  await emailInput.waitFor({ timeout: 15000 });
  await emailInput.fill(EMAIL);

  // Click Continue / Next to advance to the password step
  const continueBtn = page.getByRole("button", { name: /continue|next/i });
  await continueBtn.click();

  const passwordInput = page.getByRole("textbox", { name: /password/i }).or(page.locator('input[type="password"]'));
  await passwordInput.waitFor({ timeout: 10000 });
  await passwordInput.fill(PASSWORD);

  await page.getByRole("button", { name: /sign in|continue/i }).click();

  // Wait for redirect into /app
  await page.waitForURL(`${BASE}/app/**`, { timeout: 15000 });
  await expect(page).not.toHaveURL(/sign-in/);
  console.log("✅ Signed in — landed on:", page.url());

  // ── 2. Packages page ───────────────────────────────────────────────────────
  await page.goto(`${BASE}/app/packages`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: /packages/i })).toBeVisible({ timeout: 10000 });
  console.log("✅ Packages page loaded");

  // ── 3. Sessions page ───────────────────────────────────────────────────────
  await page.goto(`${BASE}/app/sessions`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: /sessions/i })).toBeVisible({ timeout: 10000 });
  console.log("✅ Sessions page loaded");

  // ── 4. Billing settings ────────────────────────────────────────────────────
  await page.goto(`${BASE}/app/settings?section=billing`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: /billing/i })).toBeVisible({ timeout: 10000 });

  const manageBillingBtn = page.getByRole("button", { name: /manage billing/i });
  const upgradeBtn       = page.getByRole("button", { name: /upgrade/i });

  const hasManage  = await manageBillingBtn.isVisible();
  const hasUpgrade = await upgradeBtn.isVisible();
  console.log(`✅ Billing loaded — Manage billing: ${hasManage} | Upgrade: ${hasUpgrade}`);

  // ── 5. IRA page — Advanta IRA ──────────────────────────────────────────────
  await page.goto(`${BASE}/ira`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/advanta ira/i)).toBeVisible({ timeout: 10000 });
  console.log("✅ IRA page — Advanta IRA visible");

  // ── 6. Sign out ────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/app/settings`);
  await page.waitForLoadState("networkidle");

  // User avatar / menu is typically at the top-right
  const avatarBtn = page.locator('[data-testid="user-menu"], [aria-label*="user" i], [aria-label*="account" i]').first();
  if (await avatarBtn.isVisible()) {
    await avatarBtn.click();
  } else {
    // Fallback: look for any button/link containing sign out text
    await page.getByRole("button", { name: /sign out|log out/i }).first().click();
  }

  const signOutLink = page.getByRole("menuitem", { name: /sign out|log out/i })
    .or(page.getByRole("button", { name: /sign out|log out/i }))
    .or(page.getByRole("link",   { name: /sign out|log out/i }));

  await signOutLink.waitFor({ timeout: 5000 });
  await signOutLink.click();

  await page.waitForURL(`${BASE}/app/sign-in`, { timeout: 10000 });
  console.log("✅ Signed out successfully");
});
