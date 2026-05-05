/**
 * Docuplete — Smoke Test
 * Paste into Checkly Browser Check editor.
 *
 * Uses CommonJS require + manual browser setup — works on ALL Checkly
 * runtimes (2022.10 and 2024.02). No TypeScript, no ES imports.
 */

const { chromium } = require("playwright");

const BASE     = "https://www.westhillscapital.com";
const EMAIL    = "bigej36290@lohinja.com";
const PASSWORD = "T35tacc0nt";

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();

  // Pre-seed consent cookie so the banner never blocks clicks
  await context.addCookies([{
    name:   "whc_cookie_consent",
    value:  "granted",
    domain: "www.westhillscapital.com",
    path:   "/",
  }]);

  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(30_000);
  console.log("✅ [0] browser ready");

  // ── 1. Load sign-in page ────────────────────────────────────────────────
  await page.goto(`${BASE}/app/sign-in`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  console.log("✅ [1] sign-in page:", page.url());

  // ── 2. Email input ──────────────────────────────────────────────────────
  await page.locator('input[type="email"], input[name="identifier"]').first().waitFor({ state: "visible", timeout: 20_000 });
  console.log("✅ [2] email input visible");

  // ── 3. Fill email → Enter ───────────────────────────────────────────────
  await page.locator('input[type="email"], input[name="identifier"]').first().fill(EMAIL);
  await page.keyboard.press("Enter");
  console.log("✅ [3] email submitted");

  // ── 4. Password input ───────────────────────────────────────────────────
  await page.locator('input[type="password"]').first().waitFor({ state: "visible", timeout: 15_000 });
  console.log("✅ [4] password input visible");

  // ── 5. Fill password → submit ───────────────────────────────────────────
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button.cl-formButtonPrimary:not([aria-hidden="true"])').first().click();
  console.log("✅ [5] submit clicked");

  // ── 6. Wait for redirect ─────────────────────────────────────────────────
  await page.waitForURL(/\/app(?!\/sign-in)/, { timeout: 30_000 });
  console.log("✅ [6] redirected to:", page.url());

  // ── 7. Packages page ─────────────────────────────────────────────────────
  await page.goto(`${BASE}/app/packages`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.locator("text=Package Builder").first().waitFor({ state: "visible", timeout: 12_000 });
  console.log("✅ [7] packages page loaded");

  // ── 8. Sessions page ─────────────────────────────────────────────────────
  await page.goto(`${BASE}/app/sessions`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.locator("h1, h2").filter({ hasText: /sessions/i }).first().waitFor({ state: "visible", timeout: 12_000 });
  console.log("✅ [8] sessions page loaded");

  // ── 9. Settings page ─────────────────────────────────────────────────────
  await page.goto(`${BASE}/app/settings`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.locator("[data-nav]").first().waitFor({ state: "visible", timeout: 12_000 });
  console.log("✅ [9] settings sidebar loaded");

  await browser.close();
  console.log("\n🎉 Smoke test passed.");
})().catch(async (err) => {
  console.error("❌ Test failed:", err.message);
  process.exit(1);
});
