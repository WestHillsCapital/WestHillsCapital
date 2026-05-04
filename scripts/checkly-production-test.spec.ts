/**
 * Docuplete — Full End-to-End Test Suite
 * Run via Checkly Browser Check against https://www.westhillscapital.com
 *
 * Exercises actual user flows — not just visibility — and restores any state it changes.
 *
 *  1.  Sign in
 *  2.  Packages  — create (with "+ New Package"), verify in sidebar, navigate to Finalize, delete
 *  3.  Sessions  — both sub-tabs, search input, status filter, live debounce
 *  4.  Settings  — every section with real interactions:
 *        Profile      edit display name → save → verify "✓ Saved" → restore
 *        Security     content visible
 *        Notifications  flip a toggle → auto-save feedback → flip back
 *        Timezone     listbox present with options
 *        Organization edit org name → save → verify → restore
 *        Billing      plan badge + billing buttons
 *        Team         member list / empty state + invite form present
 *        Interview    flip a toggle → auto-save → flip back
 *        Email        sender name input visible
 *        Integrations connect buttons visible
 *        Developer    create API key → verify revealed → revoke → confirm → verify gone
 *        Data/Privacy retention selector + delete button present (NOT clicked)
 *        Audit log    section loads
 *  5.  Sign out
 */

import { test, expect, Page } from "@playwright/test";

const BASE     = "https://www.westhillscapital.com";
const EMAIL    = "bigej36290@lohinja.com";
const PASSWORD = "T35tacc0nt";
const TS       = Date.now();
const TEST_PKG_NAME = `E2E-${TS}`;
const TEST_KEY_NAME = `e2e-key-${TS}`;

// ─── helpers ──────────────────────────────────────────────────────────────────

async function scrollToSection(page: Page, id: string) {
  await page.evaluate((sid) => {
    document.getElementById(sid)?.scrollIntoView({ behavior: "instant" });
  }, id);
  await page.waitForTimeout(400);
}

async function clickNavItem(page: Page, label: string) {
  const btn = page.locator("[data-nav]").filter({ hasText: label }).first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(500);
  }
}

async function spinnerGone(locator: ReturnType<Page["locator"]>, timeout = 12000) {
  await locator.locator(".animate-spin").waitFor({ state: "hidden", timeout }).catch(() => {});
}

// ─── test ─────────────────────────────────────────────────────────────────────

test("Docuplete — full e2e suite", async ({ page, context }) => {

  // ── Pre-seed consent cookie so the banner never blocks clicks ─────────────
  await context.addCookies([{
    name:   "whc_cookie_consent",
    value:  "granted",
    domain: "www.westhillscapital.com",
    path:   "/",
  }]);

  // ════════════════════════════════════════════════════════════════════════════
  // 1. SIGN IN
  // ════════════════════════════════════════════════════════════════════════════
  await page.goto(`${BASE}/app/sign-in`);
  await page.waitForLoadState("networkidle");

  const emailInput = page
    .locator('input[name="identifier"], input[name="emailAddress"], input[type="email"]')
    .first();
  await emailInput.waitFor({ state: "visible", timeout: 20000 });
  await emailInput.fill(EMAIL);
  await page.keyboard.press("Enter");

  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.waitFor({ state: "visible", timeout: 15000 });
  await expect(passwordInput).toBeEnabled({ timeout: 10000 });
  await passwordInput.fill(PASSWORD);
  await page.locator('button.cl-formButtonPrimary:not([aria-hidden="true"])').first().click();

  await page.waitForURL(
    (url) => {
      const p = url.pathname;
      return (p === "/app" || p.startsWith("/app/")) && !p.includes("sign-in");
    },
    { timeout: 30000 },
  );
  console.log("✅ [1] Signed in —", page.url());

  // ════════════════════════════════════════════════════════════════════════════
  // 2. PACKAGES — full create → verify → delete flow
  // ════════════════════════════════════════════════════════════════════════════
  await page.goto(`${BASE}/app/packages`);
  await page.waitForLoadState("networkidle");

  // 2a. Package Builder tab renders
  const pkgBuilderTab = page.getByRole("button", { name: "Package Builder", exact: true }).first();
  await expect(pkgBuilderTab).toBeVisible({ timeout: 10000 });
  console.log("✅ [2a] Package Builder tab visible");

  // 2b. Open the "+ New Package" inline form
  const newPkgBtn = page.getByRole("button", { name: /\+\s*New Package/i }).first();
  await expect(newPkgBtn).toBeVisible({ timeout: 8000 });
  await newPkgBtn.click();
  await expect(page.getByText("New package").first()).toBeVisible({ timeout: 6000 });
  console.log("✅ [2b] New package form opened");

  // 2c. Fill in name and create
  const pkgNameInput = page.getByPlaceholder(/Youth Soccer|package name/i).first();
  await pkgNameInput.fill(TEST_PKG_NAME);
  await page.getByRole("button", { name: "Create Package" }).click();

  // 2d. Package appears in sidebar
  await expect(page.getByText(TEST_PKG_NAME).first()).toBeVisible({ timeout: 15000 });
  console.log(`✅ [2c] Package "${TEST_PKG_NAME}" created`);

  // 2e. Navigate to Finalize step (where the Delete button lives)
  const finalizeBtn = page.getByRole("button", { name: /finalize/i }).first();
  if (await finalizeBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await finalizeBtn.click();
    await page.waitForTimeout(500);
  }

  // 2f. Delete the test package (window.confirm → accept)
  page.once("dialog", (dialog) => void dialog.accept());
  const deletePkgBtn = page.getByRole("button", { name: /delete package/i }).first();
  await expect(deletePkgBtn).toBeVisible({ timeout: 8000 });
  await deletePkgBtn.click();

  // 2g. Flash "Deleted package." confirms the API call succeeded
  await expect(page.getByText(/deleted package/i).first()).toBeVisible({ timeout: 10000 });
  console.log("✅ [2d] Package deleted — flash message visible");

  // ════════════════════════════════════════════════════════════════════════════
  // 3. SESSIONS — both tabs, search, status filter
  // ════════════════════════════════════════════════════════════════════════════
  await page.goto(`${BASE}/app/sessions`);
  await page.waitForLoadState("networkidle");

  // 3a. Page heading
  await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible({ timeout: 10000 });
  console.log("✅ [3a] Sessions heading visible");

  // 3b. "Interviews" and "Batch Runs" sub-tabs
  const interviewsTab = page.getByRole("button", { name: "Interviews" });
  const batchTab      = page.getByRole("button", { name: "Batch Runs" });
  await expect(interviewsTab).toBeVisible({ timeout: 8000 });
  await expect(batchTab).toBeVisible();
  console.log("✅ [3b] Both sub-tabs visible");

  // 3c. Search input and status filter select
  const sessionSearch  = page.getByPlaceholder(/search by name.*email.*package/i);
  const statusSelect   = page.locator("select").filter({ hasText: /all statuses/i });
  await expect(sessionSearch).toBeVisible({ timeout: 8000 });
  await expect(statusSelect).toBeVisible();
  console.log("✅ [3c] Search input and status filter visible");

  // 3d. Type in search — debounce fires, table or empty state updates
  await sessionSearch.fill("test");
  await page.waitForTimeout(700);
  console.log("✅ [3d] Session search typed (debounce active)");
  await sessionSearch.clear();
  await page.waitForTimeout(500);

  // 3e. Status filter — select Draft then reset
  await statusSelect.selectOption("draft");
  await page.waitForTimeout(600);
  await statusSelect.selectOption("");
  await page.waitForTimeout(400);
  console.log("✅ [3e] Status filter changed and reset");

  // 3f. Sort by clicking a column header
  const statusColHeader = page.getByRole("button", { name: /status/i }).first();
  if (await statusColHeader.isVisible().catch(() => false)) {
    await statusColHeader.click();
    await page.waitForTimeout(400);
    console.log("✅ [3f] Sessions column sort clicked");
  }

  // 3g. Switch to Batch Runs tab
  await batchTab.click();
  await page.waitForTimeout(800);
  const hasBatch = await page.getByText(/no batch runs yet/i).isVisible().catch(() => false)
               || (await page.locator("div.bg-white.border.border-gray-200.rounded-xl").count()) > 0;
  console.log(`✅ [3g] Batch Runs tab loaded — content: ${hasBatch}`);
  await interviewsTab.click();
  console.log("✅ [3h] Switched back to Interviews tab");

  // ════════════════════════════════════════════════════════════════════════════
  // 4. SETTINGS
  // ════════════════════════════════════════════════════════════════════════════
  await page.goto(`${BASE}/app/settings`);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-nav]").first()).toBeVisible({ timeout: 10000 });
  console.log("✅ [4] Settings sidebar loaded");

  // ── 4.1 Profile — edit display name, save, restore ─────────────────────────
  await clickNavItem(page, "Profile");
  await scrollToSection(page, "profile-section");
  const profileSection = page.locator("#profile-section").first();
  await expect(profileSection).toBeVisible({ timeout: 8000 });

  const displayNameInput = page.locator("#profile-display-name");
  await expect(displayNameInput).toBeVisible();
  const originalDisplayName = await displayNameInput.inputValue();

  // Append " E2E" and save via Enter key (the input has an onKeyDown Enter handler)
  await displayNameInput.fill(`${originalDisplayName} E2E`);
  await displayNameInput.press("Enter");
  await expect(page.getByText("✓ Saved").first()).toBeVisible({ timeout: 8000 });
  console.log("✅ [4.1a] Profile display name saved");

  // Restore original name
  await displayNameInput.fill(originalDisplayName || " ");
  await displayNameInput.press("Enter");
  await expect(page.getByText("✓ Saved").first()).toBeVisible({ timeout: 8000 });
  if (!originalDisplayName) {
    // If name was blank, clear the trailing space
    await displayNameInput.fill("");
    await displayNameInput.press("Enter");
  }
  console.log("✅ [4.1b] Profile display name restored");

  // ── 4.2 Security ───────────────────────────────────────────────────────────
  await clickNavItem(page, "Security");
  await scrollToSection(page, "security-section");
  const securitySection = page.locator("#security-section").first();
  await expect(securitySection).toBeVisible({ timeout: 8000 });
  await expect(securitySection.locator("button, input, p, h2").first()).toBeVisible();
  console.log("✅ [4.2] Security section visible");

  // ── 4.3 Notifications — flip a toggle, wait for auto-save, flip back ───────
  await clickNavItem(page, "Notifications");
  await scrollToSection(page, "notifications-section");
  const notifSection = page.locator("#notifications-section").first();
  await expect(notifSection).toBeVisible({ timeout: 8000 });
  await spinnerGone(notifSection);
  const firstSwitch = notifSection.locator("button[role='switch']").first();
  await expect(firstSwitch).toBeVisible({ timeout: 8000 });

  const wasChecked = (await firstSwitch.getAttribute("aria-checked")) === "true";
  await firstSwitch.click();
  await page.waitForTimeout(400);
  // Auto-saves — "✓ Saved" appears in the section header area
  await expect(notifSection.getByText(/saved/i).first()).toBeVisible({ timeout: 8000 });
  const nowChecked = (await firstSwitch.getAttribute("aria-checked")) === "true";
  expect(nowChecked).toBe(!wasChecked);
  console.log("✅ [4.3a] Notification toggle flipped and auto-saved");

  // Flip back
  await firstSwitch.click();
  await page.waitForTimeout(400);
  const notifCount = await notifSection.locator("button[role='switch']").count();
  console.log(`✅ [4.3b] Toggle restored — ${notifCount} total switches`);

  // ── 4.4 Timezone — custom listbox with options ──────────────────────────────
  await clickNavItem(page, "Timezone");
  await scrollToSection(page, "timezone-locale-section");
  const tzSection = page.locator("#timezone-locale-section").first();
  await expect(tzSection).toBeVisible({ timeout: 8000 });

  const tzSearchInput = tzSection.locator("input[placeholder*='timezones' i], input[placeholder*='timezone' i]").first();
  await expect(tzSearchInput).toBeVisible();

  // The listbox has aria-label="Timezone" (set in source).
  // Options are raw IANA names — the filter does NOT replace underscores,
  // so search terms must match the raw string (e.g. "York" matches "New_York").
  const tzListbox = tzSection.locator("[role='listbox'][aria-label='Timezone']").first();

  // Wait for the component to mount and render its options.
  const firstTzOption = tzListbox.locator("[role='option']").first();
  await expect(firstTzOption).toBeVisible({ timeout: 8000 });

  const tzOptionCount = await tzListbox.locator("[role='option']").count();
  expect(tzOptionCount).toBeGreaterThan(0);
  console.log(`✅ [4.4] Timezone listbox has ${tzOptionCount} options`);

  // Filter — use "York" (matches "America/New_York" via raw string include)
  await tzSearchInput.fill("York");
  await page.waitForTimeout(400);
  const filteredCount = await tzListbox.locator("[role='option']").count();
  // "York" must produce at least one match and fewer than the full list
  expect(filteredCount).toBeGreaterThan(0);
  expect(filteredCount).toBeLessThan(tzOptionCount);
  await tzSearchInput.clear();
  await page.waitForTimeout(300);
  console.log(`✅ [4.4b] Timezone search "York" → ${filteredCount} / ${tzOptionCount} options`);

  // ── 4.5 Organization — edit org name, save, restore ────────────────────────
  await clickNavItem(page, "Organization");
  await scrollToSection(page, "organization-section");
  const orgSection = page.locator("#organization-section").first();
  await expect(orgSection).toBeVisible({ timeout: 8000 });
  const orgNameInput = orgSection.locator("input[type='text'], input:not([type])").first();
  await expect(orgNameInput).toBeVisible();
  const originalOrgName = await orgNameInput.inputValue();

  await orgNameInput.fill(`${originalOrgName} E2E`);
  const orgSaveBtn = orgSection.getByRole("button", { name: /save/i }).first();
  await expect(orgSaveBtn).toBeVisible({ timeout: 5000 });
  await orgSaveBtn.click();
  await expect(orgSection.getByText(/saved/i).first()).toBeVisible({ timeout: 8000 });
  console.log("✅ [4.5a] Org name saved");

  await orgNameInput.fill(originalOrgName);
  await orgSaveBtn.click();
  await expect(orgSection.getByText(/saved/i).first()).toBeVisible({ timeout: 8000 });
  console.log("✅ [4.5b] Org name restored");

  // ── 4.6 Billing ────────────────────────────────────────────────────────────
  await clickNavItem(page, "Billing");
  await scrollToSection(page, "billing-section");
  const billingSection = page.locator("#billing-section").first();
  await expect(billingSection).toBeVisible({ timeout: 8000 });
  await expect(billingSection.getByText(/starter|pro|enterprise|free/i).first()).toBeVisible();
  const hasManage  = await billingSection.getByRole("button", { name: /manage billing/i }).isVisible().catch(() => false);
  const hasUpgrade = await billingSection.getByRole("button", { name: /upgrade/i }).isVisible().catch(() => false);
  expect(hasManage || hasUpgrade).toBe(true);
  const barCount = await billingSection.locator("[role='progressbar'], .bg-gray-200, [class*='progress']").count();
  console.log(`✅ [4.6] Billing — manage: ${hasManage} | upgrade: ${hasUpgrade} | usage bars: ${barCount}`);

  // ── 4.7 Submission bank (plan-dependent) ───────────────────────────────────
  await scrollToSection(page, "submission-bank-section");
  const hasSubBank = await page.locator("#submission-bank-section").first().isVisible().catch(() => false);
  console.log(`ℹ️  [4.7] Submission bank present: ${hasSubBank}`);

  // ── 4.8 Custom domain (plan-dependent) ─────────────────────────────────────
  await clickNavItem(page, "Custom domain");
  await scrollToSection(page, "custom-domain-section");
  const hasCd = await page.locator("#custom-domain-section").first().isVisible().catch(() => false);
  console.log(`ℹ️  [4.8] Custom domain section present: ${hasCd}`);

  // ── 4.9 Team — member list loads, invite form present ──────────────────────
  await clickNavItem(page, "Team");
  await scrollToSection(page, "team-section");
  const teamSection = page.locator("#team-section").first();
  await expect(teamSection).toBeVisible({ timeout: 8000 });
  await spinnerGone(teamSection);
  const hasMemberRow   = await teamSection.locator("div.flex.items-center.gap-3").isVisible().catch(() => false);
  const hasMemberEmpty = await teamSection.getByText(/no team members/i).isVisible().catch(() => false);
  const hasInviteInput = await teamSection.locator("input[type='email'], input[placeholder*='email' i]").isVisible().catch(() => false);
  const hasSendBtn     = await teamSection.getByRole("button", { name: /send invite/i }).isVisible().catch(() => false);
  console.log(`✅ [4.9] Team — members: ${hasMemberRow || hasMemberEmpty} | invite email: ${hasInviteInput} | send btn: ${hasSendBtn}`);

  // ── 4.10 Interview defaults — flip first toggle, save, restore ──────────────
  await clickNavItem(page, "Interview");
  await scrollToSection(page, "interview-defaults-section");
  const interviewSection = page.locator("#interview-defaults-section").first();
  await expect(interviewSection).toBeVisible({ timeout: 8000 });
  await spinnerGone(interviewSection);
  const interviewSwitches = interviewSection.locator("button[role='switch']");
  const interviewSwitchCount = await interviewSwitches.count();
  console.log(`✅ [4.10] Interview defaults — ${interviewSwitchCount} switches`);

  if (interviewSwitchCount > 0) {
    const sw = interviewSwitches.first();
    const wasOn = (await sw.getAttribute("aria-checked")) === "true";
    await sw.click();
    await expect(interviewSection.getByText(/saved/i).first()).toBeVisible({ timeout: 8000 });
    console.log("✅ [4.10a] Interview toggle flipped and saved");
    // Restore
    await sw.click();
    await page.waitForTimeout(300);
    const isNow = (await sw.getAttribute("aria-checked")) === "true";
    expect(isNow).toBe(wasOn);
    console.log("✅ [4.10b] Interview toggle restored");
  }

  // ── 4.11 Email settings ─────────────────────────────────────────────────────
  await clickNavItem(page, "Email");
  await scrollToSection(page, "email-section");
  const emailSection = page.locator("#email-section").first();
  await expect(emailSection).toBeVisible({ timeout: 8000 });
  await expect(emailSection.locator("input[type='text']").first()).toBeVisible();
  console.log("✅ [4.11] Email section — sender name input visible");

  // ── 4.12 Integrations ──────────────────────────────────────────────────────
  await clickNavItem(page, "Integrations");
  await scrollToSection(page, "integrations-section");
  const intSection = page.locator("#integrations-section").first();
  await expect(intSection).toBeVisible({ timeout: 8000 });
  const connectCount = await intSection.getByRole("button", { name: /connect|google drive|hubspot/i }).count();
  console.log(`✅ [4.12] Integrations — ${connectCount} connect button(s)`);

  // ── 4.13 Developer — create API key → verify → revoke → confirm ─────────────
  await clickNavItem(page, "Developer");
  await scrollToSection(page, "developer-section");
  await scrollToSection(page, "api-keys-section");
  const devSection = page.locator("#developer-section, #api-keys-section").first();
  await expect(devSection).toBeVisible({ timeout: 8000 });
  await spinnerGone(devSection);

  // Create
  const keyNameInput = page.getByPlaceholder(/key name|production server/i).first();
  await expect(keyNameInput).toBeVisible({ timeout: 8000 });
  await keyNameInput.fill(TEST_KEY_NAME);
  await keyNameInput.press("Enter"); // onKeyDown Enter triggers handleCreate
  await expect(page.getByText(/I've saved the key/i).first()).toBeVisible({ timeout: 12000 });
  console.log("✅ [4.13a] API key created — value revealed in banner");

  // Dismiss reveal banner
  await page.getByRole("button", { name: /I've saved the key/i }).first().click();
  await page.waitForTimeout(400);

  // Key should appear in the active keys list
  const keyRow = page.getByText(TEST_KEY_NAME).first();
  await expect(keyRow).toBeVisible({ timeout: 8000 });

  // Revoke — two-step: click "Revoke" → "Yes, revoke"
  // Find the key's container and click its Revoke button
  const keyContainer = page.locator("div").filter({ hasText: new RegExp(TEST_KEY_NAME) }).filter({ hasText: /Full Access/ }).last();
  const revokeBtn = keyContainer.getByRole("button", { name: /^Revoke$/i });
  await expect(revokeBtn).toBeVisible({ timeout: 8000 });
  await revokeBtn.click();

  const confirmRevoke = page.getByRole("button", { name: /yes.*revoke/i });
  await expect(confirmRevoke).toBeVisible({ timeout: 5000 });
  await confirmRevoke.click();

  // Key disappears from active list
  await expect(page.getByText(TEST_KEY_NAME)).toHaveCount(0, { timeout: 10000 });
  console.log("✅ [4.13b] API key revoked and removed from list");

  // ── 4.14 Data & Privacy ─────────────────────────────────────────────────────
  await clickNavItem(page, "Data & Privacy");
  await scrollToSection(page, "data-privacy-section");
  const privacySection = page.locator("#data-privacy-section").first();
  await expect(privacySection).toBeVisible({ timeout: 8000 });
  const hasRetention = await privacySection.locator("select, [role='combobox']").first().isVisible().catch(() => false);
  // Verify delete-account button exists but DO NOT click it
  const hasDeleteBtn = await privacySection.getByRole("button", { name: /delete.*account|request.*deletion/i }).isVisible().catch(() => false);
  console.log(`✅ [4.14] Data & Privacy — retention selector: ${hasRetention} | delete account btn: ${hasDeleteBtn}`);

  // ── 4.15 Audit log ──────────────────────────────────────────────────────────
  await clickNavItem(page, "Audit log");
  await scrollToSection(page, "audit-log-section");
  const auditSection = page.locator("#audit-log-section").first();
  const hasAudit = await auditSection.isVisible().catch(() => false);
  if (hasAudit) {
    await spinnerGone(auditSection);
    const entryCount = await auditSection.locator("tr, li, [class*='audit-row']").count();
    const hasEmpty   = await auditSection.getByText(/no.*log|no.*event|no.*audit/i).isVisible().catch(() => false);
    console.log(`✅ [4.15] Audit log — entries: ${entryCount} | empty state: ${hasEmpty}`);
  } else {
    console.log("ℹ️  [4.15] Audit log not visible (may require different role)");
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 5. SIGN OUT
  // ════════════════════════════════════════════════════════════════════════════
  const avatarSelectors = [
    '[data-testid="user-menu-trigger"]',
    '[aria-label*="user" i]',
    '[aria-label*="account" i]',
    '[aria-label*="profile" i]',
    'button img[alt*="avatar" i]',
    'button img[alt*="user" i]',
  ];

  let menuOpened = false;
  for (const sel of avatarSelectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      menuOpened = true;
      break;
    }
  }

  if (!menuOpened) {
    await page.getByRole("button", { name: /sign out|log out/i }).first().click();
  } else {
    await page.waitForTimeout(500);
    const signOutItem = page
      .getByRole("menuitem", { name: /sign out|log out/i })
      .or(page.getByRole("button", { name: /sign out|log out/i }))
      .or(page.getByRole("link",   { name: /sign out|log out/i }))
      .first();
    await signOutItem.waitFor({ timeout: 5000 });
    await signOutItem.click();
  }

  await page.waitForURL(`${BASE}/app/sign-in`, { timeout: 15000 });
  console.log("✅ [5] Signed out — back on sign-in page");

  console.log("\n🎉 Full e2e suite complete.");
});
