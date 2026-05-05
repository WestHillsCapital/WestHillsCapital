/**
 * Docuplete — Core E2E Suite
 * Target runtime: < 3 minutes
 *
 * Covers the five flows most likely to break silently in production:
 *  1. Sign in
 *  2. Packages  — create → verify → delete (real API write + window.confirm)
 *  3. Sessions  — both tabs + search filter
 *  4. Settings  — profile save, notification toggle, API key create/revoke
 *  5. Sign out
 */

import { test, expect } from "@playwright/test";

const BASE         = "https://www.westhillscapital.com";
const EMAIL        = "bigej36290@lohinja.com";
const PASSWORD     = "T35tacc0nt";
const TS           = Date.now();
const TEST_PKG     = `E2E-${TS}`;
const TEST_KEY     = `e2e-key-${TS}`;

test("Docuplete — core e2e", async ({ page, context }) => {

  // Pre-seed cookie so the consent banner never blocks clicks
  await context.addCookies([{
    name: "whc_cookie_consent", value: "granted",
    domain: "www.westhillscapital.com", path: "/",
  }]);

  // ══════════════════════════════════════════════════════════════════════════
  // 1. SIGN IN
  // ══════════════════════════════════════════════════════════════════════════
  await page.goto(`${BASE}/app/sign-in`, { waitUntil: "domcontentloaded" });

  const emailInput = page.locator(
    'input[name="identifier"], input[name="emailAddress"], input[type="email"]'
  ).first();
  await emailInput.waitFor({ state: "visible", timeout: 20000 });
  await emailInput.fill(EMAIL);
  await page.keyboard.press("Enter");

  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.waitFor({ state: "visible", timeout: 15000 });
  await passwordInput.fill(PASSWORD);
  await page.locator('button.cl-formButtonPrimary:not([aria-hidden="true"])').first().click();

  await page.waitForURL(
    (url) => url.pathname.startsWith("/app") && !url.pathname.includes("sign-in"),
    { timeout: 30000 },
  );
  console.log("✅ [1] Signed in");

  // ══════════════════════════════════════════════════════════════════════════
  // 2. PACKAGES — create → verify → delete
  // ══════════════════════════════════════════════════════════════════════════
  await page.goto(`${BASE}/app/packages`, { waitUntil: "domcontentloaded" });

  // Package Builder tab
  await expect(
    page.getByRole("button", { name: "Package Builder", exact: true }).first()
  ).toBeVisible({ timeout: 12000 });

  // Open new-package form
  await page.getByRole("button", { name: /\+\s*New Package/i }).first().click();
  await expect(page.getByText("New package").first()).toBeVisible({ timeout: 6000 });

  // Fill name and create
  await page.getByPlaceholder(/Youth Soccer|package name/i).first().fill(TEST_PKG);
  await page.getByRole("button", { name: "Create Package" }).click();

  // Package appears in sidebar
  await expect(page.getByText(TEST_PKG).first()).toBeVisible({ timeout: 15000 });
  console.log(`✅ [2a] Package "${TEST_PKG}" created`);

  // Navigate to Finalize step where the Delete button lives
  const finalizeBtn = page.getByRole("button", { name: /finalize/i }).first();
  if (await finalizeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await finalizeBtn.click();
    await page.waitForTimeout(400);
  }

  // Delete (accepts window.confirm dialog)
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: /delete package/i }).first().click();
  await expect(page.getByText(/deleted package/i).first()).toBeVisible({ timeout: 10000 });
  console.log("✅ [2b] Package deleted");

  // ══════════════════════════════════════════════════════════════════════════
  // 3. SESSIONS — tabs + search
  // ══════════════════════════════════════════════════════════════════════════
  await page.goto(`${BASE}/app/sessions`, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible({ timeout: 12000 });

  // Both sub-tabs exist
  const interviewsTab = page.getByRole("button", { name: "Interviews" });
  const batchTab      = page.getByRole("button", { name: "Batch Runs" });
  await expect(interviewsTab).toBeVisible({ timeout: 8000 });
  await expect(batchTab).toBeVisible();

  // Search input and status filter
  const sessionSearch = page.getByPlaceholder(/search by name.*email.*package/i);
  await expect(sessionSearch).toBeVisible({ timeout: 8000 });
  await expect(page.locator("select").filter({ hasText: /all statuses/i })).toBeVisible();

  // Typing in search doesn't break
  await sessionSearch.fill("test");
  await page.waitForTimeout(600);
  await sessionSearch.clear();

  // Batch Runs tab loads
  await batchTab.click();
  await page.waitForTimeout(600);
  console.log("✅ [3] Sessions — both tabs, search OK");

  // ══════════════════════════════════════════════════════════════════════════
  // 4. SETTINGS — three critical sub-flows
  // ══════════════════════════════════════════════════════════════════════════
  await page.goto(`${BASE}/app/settings`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-nav]").first()).toBeVisible({ timeout: 12000 });
  console.log("✅ [4] Settings loaded");

  // ── 4a. Profile display name — edit → save → restore ─────────────────────
  await page.evaluate(() =>
    document.getElementById("profile-section")?.scrollIntoView({ behavior: "instant" })
  );
  await page.waitForTimeout(300);

  const displayNameInput = page.locator("#profile-display-name");
  await expect(displayNameInput).toBeVisible({ timeout: 8000 });
  const origName = await displayNameInput.inputValue();

  await displayNameInput.fill(`${origName} E2E`);
  await displayNameInput.press("Enter");
  await expect(page.getByText("✓ Saved").first()).toBeVisible({ timeout: 8000 });
  console.log("✅ [4a] Display name saved");

  await displayNameInput.fill(origName || " ");
  await displayNameInput.press("Enter");
  await expect(page.getByText("✓ Saved").first()).toBeVisible({ timeout: 8000 });
  console.log("✅ [4a] Display name restored");

  // ── 4b. Notifications — flip first toggle, verify auto-save, flip back ────
  const notifNavBtn = page.locator("[data-nav]").filter({ hasText: "Notifications" }).first();
  if (await notifNavBtn.isVisible().catch(() => false)) await notifNavBtn.click();
  await page.waitForTimeout(400);
  await page.evaluate(() =>
    document.getElementById("notifications-section")?.scrollIntoView({ behavior: "instant" })
  );

  const notifSection = page.locator("#notifications-section").first();
  await expect(notifSection).toBeVisible({ timeout: 8000 });
  // Wait for async load spinner
  await notifSection.locator(".animate-spin").waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});

  const firstSwitch = notifSection.locator("button[role='switch']").first();
  await expect(firstSwitch).toBeVisible({ timeout: 8000 });
  const wasOn = (await firstSwitch.getAttribute("aria-checked")) === "true";
  await firstSwitch.click();
  await expect(notifSection.getByText(/saved/i).first()).toBeVisible({ timeout: 8000 });
  await firstSwitch.click(); // restore
  expect((await firstSwitch.getAttribute("aria-checked")) === "true").toBe(wasOn);
  console.log("✅ [4b] Notification toggle saved and restored");

  // ── 4c. Developer — create API key → verify → revoke ─────────────────────
  const devNavBtn = page.locator("[data-nav]").filter({ hasText: "Developer" }).first();
  if (await devNavBtn.isVisible().catch(() => false)) await devNavBtn.click();
  await page.waitForTimeout(400);
  await page.evaluate(() =>
    document.getElementById("api-keys-section")?.scrollIntoView({ behavior: "instant" })
  );

  const keyNameInput = page.getByPlaceholder(/key name|production server/i).first();
  await expect(keyNameInput).toBeVisible({ timeout: 10000 });
  await keyNameInput.fill(TEST_KEY);
  await keyNameInput.press("Enter");

  // Key is revealed in a banner
  await expect(page.getByText(/I've saved the key/i).first()).toBeVisible({ timeout: 12000 });
  console.log("✅ [4c] API key created");

  // Dismiss banner
  await page.getByRole("button", { name: /I've saved the key/i }).first().click();
  await page.waitForTimeout(300);

  // Key appears in active list — find its row and revoke
  await expect(page.getByText(TEST_KEY).first()).toBeVisible({ timeout: 8000 });
  const keyCard = page.locator("div").filter({ hasText: TEST_KEY }).filter({ hasText: /Full Access/ }).last();
  await keyCard.getByRole("button", { name: /^Revoke$/i }).click();
  await page.getByRole("button", { name: /yes.*revoke/i }).click();
  await expect(page.getByText(TEST_KEY)).toHaveCount(0, { timeout: 10000 });
  console.log("✅ [4c] API key revoked");

  // ══════════════════════════════════════════════════════════════════════════
  // 5. SIGN OUT
  // ══════════════════════════════════════════════════════════════════════════
  const avatarSelectors = [
    '[data-testid="user-menu-trigger"]',
    '[aria-label*="user" i]',
    '[aria-label*="account" i]',
    '[aria-label*="profile" i]',
    'button img[alt*="avatar" i]',
    'button img[alt*="user" i]',
  ];

  let opened = false;
  for (const sel of avatarSelectors) {
    if (await page.locator(sel).first().isVisible().catch(() => false)) {
      await page.locator(sel).first().click();
      opened = true;
      break;
    }
  }

  if (!opened) {
    await page.getByRole("button", { name: /sign out|log out/i }).first().click();
  } else {
    await page.waitForTimeout(400);
    const signOutItem = page
      .getByRole("menuitem", { name: /sign out|log out/i })
      .or(page.getByRole("button", { name: /sign out|log out/i }))
      .or(page.getByRole("link",   { name: /sign out|log out/i }))
      .first();
    await signOutItem.waitFor({ timeout: 5000 });
    await signOutItem.click();
  }

  await page.waitForURL(`${BASE}/app/sign-in`, { timeout: 15000 });
  console.log("✅ [5] Signed out");

  console.log("\n🎉 Core e2e suite passed.");
});
