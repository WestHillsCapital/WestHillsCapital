/**
 * Docuplete — Settings Deep Check
 * Checkly Browser Check — runtime: 2025.04
 *
 * Walks every settings section (the ones not covered by the core check):
 *   Organization · Billing · Team · Security · Timezone · Interview defaults ·
 *   Email · Integrations · Data & Privacy · Audit log · Custom domain
 *
 * Strategy: nav → scroll → wait for spinner → verify key element.
 * No destructive writes — we read state and verify UI, not save forms.
 *
 * Hard limit: 240 s. Expected runtime: ~110 s.
 */

import { test, expect } from "@playwright/test";

const BASE     = "https://www.westhillscapital.com";
const EMAIL    = "bigej36290@lohinja.com";
const PASSWORD = "T35tacc0nt";

test("Docuplete — settings deep", async ({ page, context }) => {

  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(30_000);

  await context.addCookies([{
    name: "whc_cookie_consent", value: "granted",
    domain: "www.westhillscapital.com", path: "/",
  }]);

  // ══════════════════════════════════════════════════════════════════════════
  // SIGN IN
  // ══════════════════════════════════════════════════════════════════════════
  await page.goto(`${BASE}/app/sign-in`, { waitUntil: "domcontentloaded", timeout: 30_000 });

  const emailInput = page.locator('input[type="email"], input[name="identifier"]').first();
  await emailInput.waitFor({ state: "visible", timeout: 20_000 });
  await emailInput.fill(EMAIL);
  await page.keyboard.press("Enter");

  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.waitFor({ state: "visible", timeout: 15_000 });
  await passwordInput.fill(PASSWORD);
  await page.locator('button.cl-formButtonPrimary:not([aria-hidden="true"])').first().click();

  await page.waitForURL(/\/app(?!\/sign-in)/, { timeout: 30_000 });
  console.log("✅ signed in →", page.url());

  // ══════════════════════════════════════════════════════════════════════════
  // SETTINGS PAGE
  // ══════════════════════════════════════════════════════════════════════════
  await page.goto(`${BASE}/app/settings`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await expect(page.locator("[data-nav]").first()).toBeVisible({ timeout: 12_000 });
  console.log("✅ settings loaded");

  // Helper: nav to a section, scroll it into view, wait for any loading spinner
  async function goSection(navId: string, sectionId?: string) {
    const sid = sectionId ?? navId;
    await page.locator(`[data-nav='${navId}']`).first().click();
    await page.waitForTimeout(300);
    await page.evaluate((id) =>
      document.getElementById(id)?.scrollIntoView({ behavior: "instant" }), sid
    );
    const sec = page.locator(`#${sid}`).first();
    await expect(sec).toBeVisible({ timeout: 10_000 });
    // Wait for any loading spinners to clear (budget: 15 s)
    await sec.locator(".animate-spin").waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});
    return sec;
  }

  // ── Organization ──────────────────────────────────────────────────────────
  const orgSec = await goSection("organization-section");
  await expect(orgSec.getByPlaceholder(/organization name/i).first()).toBeVisible({ timeout: 8_000 });
  console.log("✅ [org] Organization section loaded — name input present");

  // ── Billing ───────────────────────────────────────────────────────────────
  const billSec = await goSection("billing-section");
  await expect(billSec.getByText(/usage this billing period/i).first()).toBeVisible({ timeout: 12_000 });
  // Verify the three usage bars render
  await expect(billSec.getByText(/packages/i).first()).toBeVisible();
  await expect(billSec.getByText(/interview submissions/i).first()).toBeVisible();
  await expect(billSec.getByText(/team seats/i).first()).toBeVisible();
  console.log("✅ [billing] Billing section loaded — usage bars present");

  // ── Team ──────────────────────────────────────────────────────────────────
  const teamSec = await goSection("team-section");
  // Invite form is admin-only; placeholder is "colleague@company.com" (not "email")
  // Member list is always present — check whichever renders
  const inviteInput = teamSec.getByPlaceholder(/colleague/i).first();
  const memberList  = teamSec.locator("div.divide-y, p").first();
  const teamLoaded = await inviteInput.isVisible({ timeout: 8_000 }).catch(() => false)
    || await memberList.isVisible({ timeout: 2_000 }).catch(() => false);
  expect(teamLoaded).toBe(true);
  console.log("✅ [team] Team section loaded");

  // ── Security ──────────────────────────────────────────────────────────────
  const secSec = await goSection("security-section");
  await expect(secSec.getByText(/security/i).first()).toBeVisible({ timeout: 8_000 });
  // At least one password input should be present
  await expect(secSec.locator('input[type="password"]').first()).toBeVisible({ timeout: 8_000 });
  console.log("✅ [security] Security section loaded — password field present");

  // ── Timezone & Locale ─────────────────────────────────────────────────────
  const tzSec = await goSection("timezone-locale-section");
  await expect(tzSec.getByPlaceholder(/search timezones/i).first()).toBeVisible({ timeout: 8_000 });
  console.log("✅ [timezone] Timezone section loaded — search input present");

  // ── Interview defaults ────────────────────────────────────────────────────
  const intSec = await goSection("interview-defaults-section");
  await expect(intSec.getByText(/interview defaults/i).first()).toBeVisible({ timeout: 8_000 });
  console.log("✅ [interview] Interview defaults section loaded");

  // ── Email ─────────────────────────────────────────────────────────────────
  const emailSec = await goSection("email-section");
  await expect(emailSec.getByText(/^email$/i).first()).toBeVisible({ timeout: 8_000 });
  console.log("✅ [email] Email section loaded");

  // ── Integrations ──────────────────────────────────────────────────────────
  const intgSec = await goSection("integrations-section");
  await expect(intgSec.getByText(/integrations/i).first()).toBeVisible({ timeout: 8_000 });
  console.log("✅ [integrations] Integrations section loaded");

  // ── Data & Privacy ────────────────────────────────────────────────────────
  const dpSec = await goSection("data-privacy-section");
  await expect(dpSec.getByText(/data.*privacy/i).first()).toBeVisible({ timeout: 8_000 });
  console.log("✅ [data-privacy] Data & Privacy section loaded");

  // ── Audit log (admin only) ────────────────────────────────────────────────
  const auditSec = await goSection("audit-log-section");
  const auditSearch = auditSec.getByPlaceholder(/search by user or resource/i).first();
  await expect(auditSearch).toBeVisible({ timeout: 8_000 });
  // Exercise the search filter
  await auditSearch.fill("e2e");
  await page.waitForTimeout(500);
  await auditSearch.clear();
  await page.waitForTimeout(300);
  console.log("✅ [audit] Audit log section loaded — search exercised");

  // ── Custom domain (admin only) ────────────────────────────────────────────
  const cdSec = await goSection("custom-domain-section");
  await expect(cdSec.getByText(/custom domain/i).first()).toBeVisible({ timeout: 8_000 });
  console.log("✅ [custom-domain] Custom domain section loaded");

  // ══════════════════════════════════════════════════════════════════════════
  // SIGN OUT
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
  console.log("✅ signed out");

  console.log("\n🎉 Settings deep check passed.");
});
