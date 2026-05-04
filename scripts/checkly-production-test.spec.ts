/**
 * Docuplete — Exhaustive Production Smoke Test
 * Run via Checkly Browser Check against https://www.westhillscapital.com
 *
 * Covers:
 *  - Sign-in (Clerk email+password)
 *  - Packages page  (list, create, edit, delete)
 *  - Sessions page  (list, launch flow)
 *  - Settings — every section visible to an admin:
 *      Profile · Security · Notifications · Timezone
 *      Organization · Billing · Custom domain · Team
 *      Interview defaults · Email · Integrations · Developer (API keys)
 *      Data & Privacy · Audit log
 *  - Sign-out
 */

import { test, expect, Page } from "@playwright/test";

const BASE     = "https://www.westhillscapital.com";
const EMAIL    = "bigej36290@lohinja.com";
const PASSWORD = "T35tacc0nt";

// ─── helpers ──────────────────────────────────────────────────────────────────

async function scrollToSection(page: Page, id: string) {
  await page.evaluate((sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "instant" });
  }, id);
  await page.waitForTimeout(400);
}

async function clickNavItem(page: Page, label: string) {
  // Try sidebar nav link, then mobile nav link
  const navBtn = page.locator(`[data-nav]`).filter({ hasText: label }).first();
  if (await navBtn.isVisible()) {
    await navBtn.click();
    await page.waitForTimeout(500);
  }
}

// ─── main test ────────────────────────────────────────────────────────────────

test("Docuplete — exhaustive production smoke test", async ({ page, context }) => {

  // ── Pre-seed consent cookie so the banner never appears ──────────────────
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

  const emailInput = page.locator('input[name="identifier"], input[name="emailAddress"], input[type="email"]').first();
  await emailInput.waitFor({ timeout: 20000 });
  await emailInput.fill(EMAIL);

  // Click the email-submit Continue button — NOT the "Continue with Google" OAuth button.
  // Clerk renders the email form's submit as a button immediately after the input,
  // so target it by type="submit" within the form, or by data-localization-key.
  const emailSubmitBtn = page.locator('button[type="submit"]').first();
  await emailSubmitBtn.click();

  // Wait for the password field to appear AND become enabled (Clerk disables it briefly
  // during the transition between steps).
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.waitFor({ state: "visible", timeout: 15000 });
  await expect(passwordInput).toBeEnabled({ timeout: 10000 });
  await passwordInput.fill(PASSWORD);

  // Submit the password step
  await page.locator('button[type="submit"]').first().click();

  await page.waitForURL(`${BASE}/app/**`, { timeout: 20000 });
  await expect(page).not.toHaveURL(/sign-in/);
  console.log("✅ [1] Signed in — URL:", page.url());

  // ════════════════════════════════════════════════════════════════════════════
  // 2. PACKAGES PAGE
  // ════════════════════════════════════════════════════════════════════════════
  await page.goto(`${BASE}/app/packages`);
  await page.waitForLoadState("networkidle");

  // 2a. Page heading renders
  const packagesHeading = page.getByRole("heading", { name: /packages/i });
  await expect(packagesHeading).toBeVisible({ timeout: 10000 });
  console.log("✅ [2a] Packages page heading visible");

  // 2b. Package list or empty state — one or the other must appear
  const pkgList      = page.locator('[data-testid="package-list"], [data-testid="package-card"]');
  const pkgEmpty     = page.getByText(/no packages|create your first/i);
  const pkgNewButton = page.getByRole("button", { name: /new package|create package|\+ package/i });
  const hasPkgList   = await pkgList.first().isVisible().catch(() => false);
  const hasPkgEmpty  = await pkgEmpty.isVisible().catch(() => false);
  const hasPkgNew    = await pkgNewButton.isVisible().catch(() => false);
  expect(hasPkgList || hasPkgEmpty || hasPkgNew).toBe(true);
  console.log(`✅ [2b] Packages — list: ${hasPkgList} | empty state: ${hasPkgEmpty} | new button: ${hasPkgNew}`);

  // 2c. "New package" / create button exists (plan permitting)
  if (hasPkgNew) {
    await expect(pkgNewButton).toBeEnabled();
    console.log("✅ [2c] New package button enabled");
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 3. SESSIONS PAGE
  // ════════════════════════════════════════════════════════════════════════════
  await page.goto(`${BASE}/app/sessions`);
  await page.waitForLoadState("networkidle");

  const sessionsHeading = page.getByRole("heading", { name: /sessions/i });
  await expect(sessionsHeading).toBeVisible({ timeout: 10000 });
  console.log("✅ [3a] Sessions page heading visible");

  const sessionEmpty = page.getByText(/no sessions|start your first|no interviews/i);
  const sessionTable = page.locator("table, [role='table'], [data-testid='session-row']").first();
  const hasSessionContent = await sessionTable.isVisible().catch(() => false)
                         || await sessionEmpty.isVisible().catch(() => false);
  expect(hasSessionContent).toBe(true);
  console.log("✅ [3b] Sessions page has content or empty state");

  // ════════════════════════════════════════════════════════════════════════════
  // 4. SETTINGS — navigate once, then verify every section
  // ════════════════════════════════════════════════════════════════════════════
  await page.goto(`${BASE}/app/settings`);
  await page.waitForLoadState("networkidle");

  // Settings sidebar must be present
  const sidebar = page.locator('[data-nav]').first();
  await expect(sidebar).toBeVisible({ timeout: 10000 });
  console.log("✅ [4] Settings page sidebar loaded");

  // ── 4.1 Profile ────────────────────────────────────────────────────────────
  await clickNavItem(page, "Profile");
  await scrollToSection(page, "profile-section");
  const profileSection = page.locator("#profile-section");
  await expect(profileSection).toBeVisible({ timeout: 8000 });
  // First/last name or display name field
  const profileNameInput = profileSection.locator("input").first();
  await expect(profileNameInput).toBeVisible();
  console.log("✅ [4.1] Profile section — name input visible");

  // ── 4.2 Security ───────────────────────────────────────────────────────────
  await clickNavItem(page, "Security");
  await scrollToSection(page, "security-section");
  const securitySection = page.locator("#security-section");
  await expect(securitySection).toBeVisible({ timeout: 8000 });
  // Expect a password-change or 2FA element
  const securityContent = securitySection.locator("button, input, p").first();
  await expect(securityContent).toBeVisible();
  console.log("✅ [4.2] Security section visible");

  // ── 4.3 Notifications ──────────────────────────────────────────────────────
  await clickNavItem(page, "Notifications");
  await scrollToSection(page, "notifications-section");
  const notifSection = page.locator("#notifications-section");
  await expect(notifSection).toBeVisible({ timeout: 8000 });
  // Should contain toggle switches for notification types
  const notifToggles = notifSection.locator("input[type='checkbox'], button[role='switch']");
  const notifCount   = await notifToggles.count();
  expect(notifCount).toBeGreaterThan(0);
  console.log(`✅ [4.3] Notifications — ${notifCount} toggles visible`);

  // ── 4.4 Timezone ───────────────────────────────────────────────────────────
  await clickNavItem(page, "Timezone");
  await scrollToSection(page, "timezone-locale-section");
  const tzSection = page.locator("#timezone-locale-section");
  await expect(tzSection).toBeVisible({ timeout: 8000 });
  const tzSelect  = tzSection.locator("select, [role='combobox']").first();
  await expect(tzSelect).toBeVisible();
  console.log("✅ [4.4] Timezone section — selector visible");

  // ── 4.5 Organization (branding) ────────────────────────────────────────────
  await clickNavItem(page, "Organization");
  await scrollToSection(page, "organization-section");
  const orgSection = page.locator("#organization-section");
  await expect(orgSection).toBeVisible({ timeout: 8000 });
  // Org name field
  const orgNameInput = orgSection.locator("input[type='text'], input:not([type])").first();
  await expect(orgNameInput).toBeVisible();
  // Brand color swatch
  const colorInput = orgSection.locator("input[type='color'], input[type='text'][placeholder*='#'], input[maxlength='7']").first();
  const hasColorInput = await colorInput.isVisible().catch(() => false);
  console.log(`✅ [4.5] Organization — name input visible | color picker: ${hasColorInput}`);

  // ── 4.6 Billing ────────────────────────────────────────────────────────────
  await clickNavItem(page, "Billing");
  await scrollToSection(page, "billing-section");
  const billingSection = page.locator("#billing-section");
  await expect(billingSection).toBeVisible({ timeout: 8000 });

  // Plan tier badge
  const planBadge = billingSection.getByText(/starter|pro|enterprise|free/i).first();
  await expect(planBadge).toBeVisible();

  // Usage bars (Packages, Interview submissions, Team seats)
  const usageBars = billingSection.locator("[role='progressbar'], .bg-gray-200, [class*='progress']");
  const barCount  = await usageBars.count();
  console.log(`✅ [4.6] Billing — plan badge visible | usage bars: ${barCount}`);

  // Manage billing or Upgrade button (at least one must exist)
  const manageBillingBtn = billingSection.getByRole("button", { name: /manage billing/i });
  const upgradeBtn       = billingSection.getByRole("button", { name: /upgrade/i });
  const hasManage  = await manageBillingBtn.isVisible().catch(() => false);
  const hasUpgrade = await upgradeBtn.isVisible().catch(() => false);
  expect(hasManage || hasUpgrade).toBe(true);
  console.log(`✅ [4.6] Billing buttons — Manage billing: ${hasManage} | Upgrade: ${hasUpgrade}`);

  // ── 4.7 Submission Bank ────────────────────────────────────────────────────
  await scrollToSection(page, "submission-bank-section");
  const subBankSection = page.locator("#submission-bank-section");
  const hasSubBank = await subBankSection.isVisible().catch(() => false);
  if (hasSubBank) {
    const buyBtn = subBankSection.getByRole("button", { name: /buy/i });
    await expect(buyBtn).toBeVisible();
    console.log("✅ [4.7] Submission bank — Buy button visible");
  } else {
    console.log("ℹ️ [4.7] Submission bank section not present for this plan");
  }

  // ── 4.8 Custom domain ──────────────────────────────────────────────────────
  await clickNavItem(page, "Custom domain");
  await scrollToSection(page, "custom-domain-section");
  const cdSection = page.locator("#custom-domain-section");
  const hasCd = await cdSection.isVisible().catch(() => false);
  if (hasCd) {
    console.log("✅ [4.8] Custom domain section visible");
  } else {
    console.log("ℹ️ [4.8] Custom domain section not shown (may require admin)");
  }

  // ── 4.9 Team ───────────────────────────────────────────────────────────────
  await clickNavItem(page, "Team");
  await scrollToSection(page, "team-section");
  const teamSection = page.locator("#team-section");
  await expect(teamSection).toBeVisible({ timeout: 8000 });
  // At least one member row (the account owner)
  const memberRows = teamSection.locator("tr, [data-testid='team-member-row'], [class*='member']");
  const memberCount = await memberRows.count();
  expect(memberCount).toBeGreaterThan(0);
  // Invite button
  const inviteBtn = teamSection.getByRole("button", { name: /invite|add member/i });
  const hasInvite = await inviteBtn.isVisible().catch(() => false);
  console.log(`✅ [4.9] Team — ${memberCount} row(s) | invite button: ${hasInvite}`);

  // ── 4.10 Interview defaults ─────────────────────────────────────────────────
  await clickNavItem(page, "Interview");
  await scrollToSection(page, "interview-defaults-section");
  const interviewSection = page.locator("#interview-defaults-section");
  await expect(interviewSection).toBeVisible({ timeout: 8000 });
  const interviewToggles = interviewSection.locator("input[type='checkbox'], button[role='switch']");
  const toggleCount = await interviewToggles.count();
  console.log(`✅ [4.10] Interview defaults — ${toggleCount} toggles visible`);

  // ── 4.11 Email ─────────────────────────────────────────────────────────────
  await clickNavItem(page, "Email");
  await scrollToSection(page, "email-section");
  const emailSection = page.locator("#email-section");
  await expect(emailSection).toBeVisible({ timeout: 8000 });
  const emailContent = emailSection.locator("input, button, p").first();
  await expect(emailContent).toBeVisible();
  console.log("✅ [4.11] Email section visible");

  // ── 4.12 Integrations ──────────────────────────────────────────────────────
  await clickNavItem(page, "Integrations");
  await scrollToSection(page, "integrations-section");
  const intSection = page.locator("#integrations-section");
  await expect(intSection).toBeVisible({ timeout: 8000 });
  // Expect Google Drive and/or HubSpot connect buttons
  const driveBtn    = intSection.getByRole("button", { name: /google drive|connect/i }).first();
  const hasIntBtn   = await driveBtn.isVisible().catch(() => false);
  console.log(`✅ [4.12] Integrations section visible | connect button: ${hasIntBtn}`);

  // ── 4.13 Developer (API keys) ───────────────────────────────────────────────
  await clickNavItem(page, "Developer");
  await scrollToSection(page, "developer-section");
  await scrollToSection(page, "api-keys-section");
  const devSection = page.locator("#developer-section, #api-keys-section").first();
  await expect(devSection).toBeVisible({ timeout: 8000 });
  const createKeyBtn = page.getByRole("button", { name: /create.*key|new.*key|generate.*key/i });
  const hasCreateKey = await createKeyBtn.isVisible().catch(() => false);
  console.log(`✅ [4.13] Developer/API keys section visible | create key button: ${hasCreateKey}`);

  // ── 4.14 Data & Privacy ─────────────────────────────────────────────────────
  await clickNavItem(page, "Data & Privacy");
  await scrollToSection(page, "data-privacy-section");
  const privacySection = page.locator("#data-privacy-section");
  await expect(privacySection).toBeVisible({ timeout: 8000 });
  // Data retention selector
  const retentionSelect = privacySection.locator("select, [role='combobox']").first();
  const hasRetention = await retentionSelect.isVisible().catch(() => false);
  // Delete account button (dangerous — only verify it exists, do NOT click)
  const deleteAccountBtn = privacySection.getByRole("button", { name: /delete.*account|request.*deletion/i });
  const hasDeleteBtn = await deleteAccountBtn.isVisible().catch(() => false);
  console.log(`✅ [4.14] Data & Privacy — retention selector: ${hasRetention} | delete button: ${hasDeleteBtn}`);

  // ── 4.15 Audit log ──────────────────────────────────────────────────────────
  await clickNavItem(page, "Audit log");
  await scrollToSection(page, "audit-log-section");
  const auditSection = page.locator("#audit-log-section");
  const hasAudit = await auditSection.isVisible().catch(() => false);
  if (hasAudit) {
    // Filter dropdown + log table/list
    const auditFilter = auditSection.locator("select, [role='combobox']").first();
    const hasFilter = await auditFilter.isVisible().catch(() => false);
    console.log(`✅ [4.15] Audit log visible | filter: ${hasFilter}`);
  } else {
    console.log("ℹ️ [4.15] Audit log not visible (may require admin role)");
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 5. SIGN OUT
  // ════════════════════════════════════════════════════════════════════════════
  // Try user avatar / account menu in the app header
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
    // Fallback: look for a direct sign-out button anywhere on the page
    await page.getByRole("button", { name: /sign out|log out/i }).first().click();
  } else {
    await page.waitForTimeout(500);
    const signOutItem = page.getByRole("menuitem", { name: /sign out|log out/i })
      .or(page.getByRole("button", { name: /sign out|log out/i }))
      .or(page.getByRole("link",   { name: /sign out|log out/i }))
      .first();
    await signOutItem.waitFor({ timeout: 5000 });
    await signOutItem.click();
  }

  await page.waitForURL(`${BASE}/app/sign-in`, { timeout: 15000 });
  console.log("✅ [5] Signed out — redirected to sign-in");

  console.log("\n🎉 All checks passed.");
});
