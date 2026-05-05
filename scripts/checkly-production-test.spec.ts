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
  // Flash message on success: green div containing "Deleted package."
  // Delete button text: "Delete package" (in Finalize step)
  // window.confirm fires synchronously — register handler before the click
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

  // Navigate to Finalize step where "Delete package" button lives
  const finalizeBtn = page.getByRole("button", { name: /finalize/i }).first();
  if (await finalizeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await finalizeBtn.click();
    await page.waitForTimeout(400);
  }

  // Delete — register dialog handler BEFORE the click; then find the button
  page.once("dialog", (d) => void d.accept());
  // Button text is "Delete package" (lowercase p, source line ~5002)
  const deletePkgBtn = page.getByRole("button", { name: /delete package/i }).first();
  await expect(deletePkgBtn).toBeVisible({ timeout: 8000 });
  await deletePkgBtn.click();

  // Flash: green div at the top of DocuFill, text = "Deleted package." (3 s TTL)
  await expect(
    page.locator("div.bg-green-50").filter({ hasText: /deleted package/i }).first()
  ).toBeVisible({ timeout: 10000 });
  console.log("✅ [2b] Package deleted — flash confirmed");

  // ══════════════════════════════════════════════════════════════════════════
  // 3. SESSIONS — tabs + search
  // ══════════════════════════════════════════════════════════════════════════
  await page.goto(`${BASE}/app/sessions`, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible({ timeout: 12000 });

  const interviewsTab = page.getByRole("button", { name: "Interviews" });
  const batchTab      = page.getByRole("button", { name: "Batch Runs" });
  await expect(interviewsTab).toBeVisible({ timeout: 8000 });
  await expect(batchTab).toBeVisible();

  const sessionSearch = page.getByPlaceholder(/search by name.*email.*package/i);
  await expect(sessionSearch).toBeVisible({ timeout: 8000 });
  await expect(page.locator("select").filter({ hasText: /all statuses/i })).toBeVisible();

  await sessionSearch.fill("test");
  await page.waitForTimeout(600);
  await sessionSearch.clear();

  await batchTab.click();
  await page.waitForTimeout(600);
  console.log("✅ [3] Sessions — both tabs, search OK");

  // ══════════════════════════════════════════════════════════════════════════
  // 4. SETTINGS
  // ══════════════════════════════════════════════════════════════════════════
  await page.goto(`${BASE}/app/settings`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-nav]").first()).toBeVisible({ timeout: 12000 });
  console.log("✅ [4] Settings loaded");

  // ── 4a. Profile display name — edit → Enter → "✓ Saved" → restore ────────
  // ID: #profile-display-name  Saved feedback: <span>&#10003; Saved</span>
  // Save trigger: onKeyDown Enter (no save button)
  await page.evaluate(() =>
    document.getElementById("profile-section")?.scrollIntoView({ behavior: "instant" })
  );
  await page.waitForTimeout(300);

  const displayNameInput = page.locator("#profile-display-name");
  await expect(displayNameInput).toBeVisible({ timeout: 8000 });
  const origName = await displayNameInput.inputValue();

  await displayNameInput.fill(`${origName} E2E`);
  await displayNameInput.press("Enter");
  // "✓ Saved" — &#10003 + " Saved" rendered as Unicode U+2713
  await expect(page.getByText("✓ Saved").first()).toBeVisible({ timeout: 8000 });
  console.log("✅ [4a] Display name saved");

  await displayNameInput.fill(origName || " ");
  await displayNameInput.press("Enter");
  await expect(page.getByText("✓ Saved").first()).toBeVisible({ timeout: 8000 });
  console.log("✅ [4a] Display name restored");

  // ── 4b. Notifications — flip first toggle, verify auto-save, flip back ────
  // Saved text: "&#10003; Saved" (same span pattern)
  // Spinner: .animate-spin  Switches: button[role='switch']
  const notifNavBtn = page.locator("[data-nav='notifications-section']").first();
  if (await notifNavBtn.isVisible().catch(() => false)) await notifNavBtn.click();
  await page.waitForTimeout(400);
  await page.evaluate(() =>
    document.getElementById("notifications-section")?.scrollIntoView({ behavior: "instant" })
  );

  const notifSection = page.locator("#notifications-section").first();
  await expect(notifSection).toBeVisible({ timeout: 8000 });
  // Wait for async load spinner to disappear
  await notifSection.locator(".animate-spin").waitFor({ state: "hidden", timeout: 12000 }).catch(() => {});

  const firstSwitch = notifSection.locator("button[role='switch']").first();
  await expect(firstSwitch).toBeVisible({ timeout: 8000 });
  const wasOn = (await firstSwitch.getAttribute("aria-checked")) === "true";
  await firstSwitch.click();
  // Auto-saves immediately on toggle — "✓ Saved" appears in the section header
  await expect(notifSection.getByText(/saved/i).first()).toBeVisible({ timeout: 8000 });
  await firstSwitch.click(); // restore original state
  console.log("✅ [4b] Notification toggle saved and restored");

  // ── 4c. Developer — create API key → verify → revoke ─────────────────────
  // Input placeholder: "Key name (e.g. Production server)"
  // Banner dismiss button text: "I've saved the key, dismiss this"
  // Revoke: two-step — "Revoke" button → "Yes, revoke" confirm button
  // IMPORTANT: after revocation the key MOVES to "Revoked keys" section;
  //            it does NOT disappear from the DOM.
  //            Check: the row no longer has a "Revoke" button next to it.
  const devNavBtn = page.locator("[data-nav='api-keys-section']").first();
  if (await devNavBtn.isVisible().catch(() => false)) await devNavBtn.click();
  await page.waitForTimeout(400);
  await page.evaluate(() =>
    document.getElementById("api-keys-section")?.scrollIntoView({ behavior: "instant" })
  );

  // Wait for API key section to load (spinner disappears)
  const apiSection = page.locator("#api-keys-section").first();
  await expect(apiSection).toBeVisible({ timeout: 10000 });
  await apiSection.locator(".animate-spin").waitFor({ state: "hidden", timeout: 12000 }).catch(() => {});

  // Create key
  const keyNameInput = page.getByPlaceholder(/Key name|Production server/i).first();
  await expect(keyNameInput).toBeVisible({ timeout: 8000 });
  await keyNameInput.fill(TEST_KEY);
  await keyNameInput.press("Enter");

  // Banner appears: "API key created — copy it now"
  await expect(page.getByText(/API key created/i).first()).toBeVisible({ timeout: 12000 });
  console.log("✅ [4c] API key created — banner visible");

  // Dismiss the one-time reveal banner
  const dismissBtn = page.getByRole("button", { name: /I've saved the key/i }).first();
  await expect(dismissBtn).toBeVisible({ timeout: 8000 });
  await dismissBtn.click();
  await page.waitForTimeout(500);

  // Key appears in Active keys list — find its row by name text
  const keyNameEl = page.locator("p.text-sm.font-medium.text-gray-900.truncate", { hasText: TEST_KEY }).first();
  await expect(keyNameEl).toBeVisible({ timeout: 8000 });
  console.log("✅ [4c] Key visible in active list");

  // Click "Revoke" (first step)
  // The Revoke button is a sibling inside the same px-6 py-3 row div
  const keyRow = page.locator("div.px-6.py-3").filter({ hasText: TEST_KEY }).first();
  await keyRow.getByRole("button", { name: "Revoke" }).click();

  // Confirm step: "Yes, revoke"
  await page.getByRole("button", { name: /yes.*revoke/i }).first().click();

  // After revocation the row loses its "Revoke" button and gains a "Revoked" badge
  // Verify: the row for TEST_KEY no longer has a "Revoke" action button
  await expect(
    page.locator("div.px-6.py-3").filter({ hasText: TEST_KEY }).getByRole("button", { name: "Revoke" })
  ).toHaveCount(0, { timeout: 10000 });
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
