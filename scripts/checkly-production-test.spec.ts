/**
 * Docuplete — Core E2E Suite
 * Checkly Browser Check — runtime: 2025.04
 *
 * Covers the five flows most likely to break silently in production:
 *  1. Sign in
 *  2. Packages  — create → verify → delete
 *  3. Sessions  — both tabs + search
 *  4. Settings  — profile save, notification toggle, API key create/revoke
 *  5. Sign out
 *
 * Hard limit: 240 s (Checkly max). Expected runtime: ~90 s.
 */

import { test, expect } from "@playwright/test";

const BASE      = "https://www.westhillscapital.com";
const EMAIL     = "bigej36290@lohinja.com";
const PASSWORD  = "T35tacc0nt";
const TS        = Date.now();
const TEST_PKG  = `E2E-${TS}`;
const TEST_KEY  = `e2e-key-${TS}`;

test("Docuplete — core e2e", async ({ page, context }) => {

  // Cap individual operations so nothing can hang past 30 s
  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(30_000);

  // Pre-seed consent cookie so the banner never blocks clicks
  await context.addCookies([{
    name: "whc_cookie_consent", value: "granted",
    domain: "www.westhillscapital.com", path: "/",
  }]);

  // ══════════════════════════════════════════════════════════════════════════
  // 1. SIGN IN
  // ══════════════════════════════════════════════════════════════════════════
  await page.goto(`${BASE}/app/sign-in`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  console.log("✅ [1] sign-in page loaded");

  const emailInput = page.locator('input[type="email"], input[name="identifier"]').first();
  await emailInput.waitFor({ state: "visible", timeout: 20_000 });
  await emailInput.fill(EMAIL);
  await page.keyboard.press("Enter");

  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.waitFor({ state: "visible", timeout: 15_000 });
  await passwordInput.fill(PASSWORD);
  await page.locator('button.cl-formButtonPrimary:not([aria-hidden="true"])').first().click();

  await page.waitForURL(/\/app(?!\/sign-in)/, { timeout: 30_000 });
  expect(page.url()).not.toContain("sign-in");
  console.log("✅ [1] signed in →", page.url());

  // ══════════════════════════════════════════════════════════════════════════
  // 2. PACKAGES — create → verify → delete
  // ══════════════════════════════════════════════════════════════════════════
  await page.goto(`${BASE}/app/packages`, { waitUntil: "domcontentloaded", timeout: 30_000 });

  await expect(
    page.getByRole("button", { name: "Package Builder", exact: true }).first()
  ).toBeVisible({ timeout: 12_000 });

  await page.getByRole("button", { name: /\+\s*New Package/i }).first().click();
  await expect(page.getByText("New package").first()).toBeVisible({ timeout: 6_000 });

  await page.getByPlaceholder(/Youth Soccer|package name/i).first().fill(TEST_PKG);
  await page.getByRole("button", { name: "Create Package" }).click();
  await expect(page.getByText(TEST_PKG).first()).toBeVisible({ timeout: 15_000 });
  console.log(`✅ [2a] package "${TEST_PKG}" created`);

  // Navigate to Finalize tab where the Delete button lives
  const finalizeBtn = page.getByRole("button", { name: /finalize/i }).first();
  if (await finalizeBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await finalizeBtn.click();
    await page.waitForTimeout(400);
  }

  // Delete — register dialog handler BEFORE clicking (window.confirm)
  page.once("dialog", (d) => void d.accept());
  await expect(page.getByRole("button", { name: /delete package/i }).first()).toBeVisible({ timeout: 8_000 });
  await page.getByRole("button", { name: /delete package/i }).first().click();

  // Flash: green div "Deleted package." (3 s TTL)
  await expect(
    page.locator("div.bg-green-50").filter({ hasText: /deleted package/i }).first()
  ).toBeVisible({ timeout: 10_000 });
  console.log("✅ [2b] package deleted");

  // ══════════════════════════════════════════════════════════════════════════
  // 3. SESSIONS — tabs + search
  // ══════════════════════════════════════════════════════════════════════════
  await page.goto(`${BASE}/app/sessions`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible({ timeout: 12_000 });

  const interviewsTab = page.getByRole("button", { name: "Interviews" });
  const batchTab      = page.getByRole("button", { name: "Batch Runs" });
  await expect(interviewsTab).toBeVisible({ timeout: 8_000 });
  await expect(batchTab).toBeVisible();

  const sessionSearch = page.getByPlaceholder(/search by name.*email.*package/i);
  await expect(sessionSearch).toBeVisible({ timeout: 8_000 });
  await sessionSearch.fill("test");
  await page.waitForTimeout(600);
  await sessionSearch.clear();

  await batchTab.click();
  await page.waitForTimeout(500);
  console.log("✅ [3] sessions — both tabs + search OK");

  // ══════════════════════════════════════════════════════════════════════════
  // 4. SETTINGS
  // ══════════════════════════════════════════════════════════════════════════
  await page.goto(`${BASE}/app/settings`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await expect(page.locator("[data-nav]").first()).toBeVisible({ timeout: 12_000 });
  console.log("✅ [4] settings loaded");

  // ── 4a. Profile display name ───────────────────────────────────────────────
  await page.evaluate(() =>
    document.getElementById("profile-section")?.scrollIntoView({ behavior: "instant" })
  );
  await page.waitForTimeout(300);

  const displayNameInput = page.locator("#profile-display-name");
  await expect(displayNameInput).toBeVisible({ timeout: 8_000 });
  const origName = await displayNameInput.inputValue();

  await displayNameInput.fill(`${origName} E2E`);
  await displayNameInput.press("Enter");
  await expect(page.getByText("✓ Saved").first()).toBeVisible({ timeout: 8_000 });

  await displayNameInput.fill(origName || " ");
  await displayNameInput.press("Enter");
  await expect(page.getByText("✓ Saved").first()).toBeVisible({ timeout: 8_000 });
  console.log("✅ [4a] profile name saved + restored");

  // ── 4b. Notifications toggle ───────────────────────────────────────────────
  await page.locator("[data-nav='notifications-section']").first().click();
  await page.waitForTimeout(400);
  await page.evaluate(() =>
    document.getElementById("notifications-section")?.scrollIntoView({ behavior: "instant" })
  );

  const notifSection = page.locator("#notifications-section").first();
  await expect(notifSection).toBeVisible({ timeout: 8_000 });
  await notifSection.locator(".animate-spin").waitFor({ state: "hidden", timeout: 12_000 }).catch(() => {});

  const firstSwitch = notifSection.locator("button[role='switch']").first();
  await expect(firstSwitch).toBeVisible({ timeout: 8_000 });
  const wasOn = (await firstSwitch.getAttribute("aria-checked")) === "true";
  await firstSwitch.click();
  await expect(notifSection.getByText(/saved/i).first()).toBeVisible({ timeout: 8_000 });
  await firstSwitch.click();
  expect((await firstSwitch.getAttribute("aria-checked")) === "true").toBe(wasOn);
  console.log("✅ [4b] notification toggle saved + restored");

  // ── 4c. API key create → revoke ────────────────────────────────────────────
  // Nav item id = "developer-section"; api-keys-section is just the in-page anchor
  await page.locator("[data-nav='developer-section']").first().click();
  await page.waitForTimeout(400);
  await page.evaluate(() =>
    document.getElementById("api-keys-section")?.scrollIntoView({ behavior: "instant" })
  );

  const apiSection = page.locator("#api-keys-section").first();
  await expect(apiSection).toBeVisible({ timeout: 10_000 });
  await apiSection.locator(".animate-spin").waitFor({ state: "hidden", timeout: 12_000 }).catch(() => {});

  const keyNameInput = page.getByPlaceholder(/Key name|Production server/i).first();
  await expect(keyNameInput).toBeVisible({ timeout: 8_000 });

  // pressSequentially fires real input events React's onChange actually catches.
  // fill() on a controlled input can leave React state empty, causing the
  // "Key name is required" early-exit in handleCreate.
  await keyNameInput.click();
  await keyNameInput.pressSequentially(TEST_KEY, { delay: 30 });
  await expect(keyNameInput).toHaveValue(TEST_KEY, { timeout: 5_000 });

  // Click Create button explicitly (more reliable than Enter key)
  await apiSection.getByRole("button", { name: /^Create$/i }).click();

  // Wait for banner — scoped to apiSection to avoid matching the
  // "API key created" notification-category label elsewhere on the page
  await expect(apiSection.getByText(/API key created — copy it now/i).first()).toBeVisible({ timeout: 15_000 });
  console.log("✅ [4c] API key created");

  const dismissBtn = apiSection.getByRole("button", { name: /I've saved the key/i }).first();
  await expect(dismissBtn).toBeVisible({ timeout: 8_000 });
  await dismissBtn.click();
  await page.waitForTimeout(400);

  // Revoke — two-step: "Revoke" → "Yes, revoke"
  const keyRow = page.locator("div.px-6.py-3").filter({ hasText: TEST_KEY }).first();
  await expect(keyRow.getByRole("button", { name: "Revoke" })).toBeVisible({ timeout: 8_000 });
  await keyRow.getByRole("button", { name: "Revoke" }).click();
  await page.getByRole("button", { name: /yes.*revoke/i }).first().click();

  // After revoke: the row loses its "Revoke" button (key moves to Revoked section)
  await expect(
    page.locator("div.px-6.py-3").filter({ hasText: TEST_KEY }).getByRole("button", { name: "Revoke" })
  ).toHaveCount(0, { timeout: 10_000 });
  console.log("✅ [4c] API key revoked");

  // ══════════════════════════════════════════════════════════════════════════
  // 5. SIGN OUT
  // ══════════════════════════════════════════════════════════════════════════
  for (const sel of [
    '[data-testid="user-menu-trigger"]',
    '[aria-label*="user" i]',
    '[aria-label*="account" i]',
    '[aria-label*="profile" i]',
    'button img[alt*="avatar" i]',
    'button img[alt*="user" i]',
  ]) {
    if (await page.locator(sel).first().isVisible().catch(() => false)) {
      await page.locator(sel).first().click();
      await page.waitForTimeout(400);
      const signOutItem = page
        .getByRole("menuitem", { name: /sign out|log out/i })
        .or(page.getByRole("button", { name: /sign out|log out/i }))
        .or(page.getByRole("link",   { name: /sign out|log out/i }))
        .first();
      if (await signOutItem.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await signOutItem.click();
        break;
      }
    }
  }

  await page.waitForURL(/sign-in/, { timeout: 15_000 });
  console.log("✅ [5] signed out");

  console.log("\n🎉 Core e2e suite passed.");
});
