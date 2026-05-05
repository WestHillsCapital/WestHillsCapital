/**
 * Docuplete docs screenshot capture — all 29 illustrations.
 *
 * Run from workspace root:
 *   PORT=23904 tsx artifacts/west-hills-capital/e2e/capture-screenshots.ts
 */
import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const PORT = process.env.PORT ?? "23904";
const BASE = `http://localhost:${PORT}`;
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY ?? "";
// Product-account admin Clerk user (account_id=4, "Button Test Co")
const SETTINGS_CLERK_USER = "user_3Cy2T6MdbIhWuKdUF7Yx06arfD1";
const NIX_CHROME = "/nix/store/d7y5039fgn5432kgkn0cv09hda4a7nxz-playwright-chromium-cjk-1.55.0-1187/chrome-linux/chrome";
const OUT = path.resolve(__dirname, "../../../artifacts/docuplete-docs/public/screenshots");

fs.mkdirSync(OUT, { recursive: true });
type Page = import("playwright").Page;

async function shot(page: Page, name: string) {
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  console.log(`  ✓ ${name}.png`);
}

async function dismissBanner(page: Page) {
  const btn = page.getByRole("button", { name: /^accept$/i });
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(400);
  }
}

/** Pre-dismiss the DocuFill welcome overlay via localStorage, then reload. */
async function dismissWelcomeOverlay(page: Page) {
  const overlay = page.locator("text=Experience Docuplete as your client");
  if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
    // Click "Skip, explore the builder →"
    const skipBtn = page.locator("text=Skip, explore the builder");
    if (await skipBtn.isVisible().catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(500);
    }
  }
}

async function getClerkTicket(userId: string): Promise<string> {
  const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, expires_in_seconds: 600 }),
  });
  if (!res.ok) throw new Error(`Clerk token error: ${res.status} ${await res.text()}`);
  const data = await res.json() as { url: string };
  return new URL(data.url).searchParams.get("__clerk_ticket") ?? "";
}

async function clickTab(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).first().click();
  await page.waitForTimeout(1000);
}

async function main() {
  // Seed demo data
  await fetch(`${BASE}/api/internal/docufill/seed-demo`, { method: "POST" }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1500));

  const browser = await chromium.launch({
    executablePath: NIX_CHROME,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  // ────────────────────────────────────────────────────────────────────────
  // PART 1: Internal DocuFill screenshots (22 screenshots)
  // ────────────────────────────────────────────────────────────────────────
  const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page  = await ctx1.newPage();

  // Pre-set localStorage to dismiss the demo welcome overlay before loading
  await ctx1.addInitScript(() => {
    try { localStorage.setItem("docufill:demo-ui", "dismissed"); } catch {}
  });

  // ── 1. Dashboard overview ────────────────────────────────────────────────
  console.log("§ Dashboard");
  await page.goto(`${BASE}/internal/docufill`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2500);
  await dismissBanner(page);
  await dismissWelcomeOverlay(page);
  await shot(page, "dashboard-overview");

  // ── 2. Package builder — Documents step (demo package pre-selected) ──────
  console.log("§ Package builder — Documents step");
  await page.goto(`${BASE}/internal/docufill?packageId=183`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2500);
  await dismissBanner(page);
  await dismissWelcomeOverlay(page);
  await shot(page, "quickstart-upload");

  // ── 3. Upload dialog ──────────────────────────────────────────────────────
  console.log("§ Upload dialog");
  {
    const addBtn = page.getByRole("button", { name: /add pdf|upload.*pdf|browse|add document/i }).first();
    const visible = await addBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (visible) {
      await addBtn.click();
      await page.waitForTimeout(1500);
      await shot(page, "upload-dialog");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
    } else {
      await shot(page, "upload-dialog");
    }
  }

  // ── 4. Map Fields step ────────────────────────────────────────────────────
  console.log("§ Map Fields step");
  await page.goto(`${BASE}/internal/docufill?packageId=183&step=2`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2000);
  await dismissBanner(page);
  // Click "Map Fields" step button (step 2)
  const step2Btn = page.locator("button").filter({ hasText: /Map Fields/ }).first();
  const hasStep2 = await step2Btn.isVisible({ timeout: 3000 }).catch(() => false);
  if (hasStep2) {
    await step2Btn.click();
    await page.waitForTimeout(2000);
  }
  await shot(page, "field-editor");

  // ── 5. Mapper tab (within Map Fields step) ────────────────────────────────
  console.log("§ Mapper tab");
  const mapperBtn = page.getByRole("button", { name: "Mapper", exact: true }).first();
  const hasMapper = await mapperBtn.isVisible({ timeout: 3000 }).catch(() => false);
  if (hasMapper) {
    await mapperBtn.click();
    await page.waitForTimeout(1500);
  }
  await shot(page, "mapper-overview");
  await shot(page, "quickstart-mapper");

  // ── 6. E-sign field placed ────────────────────────────────────────────────
  console.log("§ E-sign field");
  // Look for signature field in the fields list on the right panel
  {
    const sig = page.locator("text=/signature|e-sign|esign/i").first();
    if (await sig.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sig.click();
      await page.waitForTimeout(800);
    }
  }
  await shot(page, "esign-field-placed");

  // ── 7. Textbox config panel ───────────────────────────────────────────────
  console.log("§ Textbox config");
  // Click the first text field in the left fields panel
  {
    const firstField = page.locator("[class*='field']:not(button), [class*='FieldItem']").first();
    if (await firstField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstField.click();
      await page.waitForTimeout(800);
    }
  }
  await shot(page, "textbox-config");

  // ── 8. Interviews tab — new session dialog ────────────────────────────────
  console.log("§ Create session dialog");
  await page.goto(`${BASE}/internal/docufill?packageId=183&tab=interview`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2500);
  await dismissBanner(page);
  {
    const newBtn = page.getByRole("button", { name: /new session|send form|create session/i }).first();
    const hasNew = await newBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasNew) {
      await newBtn.click();
      await page.waitForTimeout(1500);
      await shot(page, "create-session-dialog");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
    } else {
      await shot(page, "create-session-dialog");
    }
  }

  // ── 9. Interviews list ────────────────────────────────────────────────────
  console.log("§ Interviews list");
  await shot(page, "interviews-list");

  // ── 10. Session detail ────────────────────────────────────────────────────
  console.log("§ Session detail");
  {
    // Click the first session row in the table
    const rows = page.locator("tbody tr");
    const count = await rows.count();
    if (count > 0) {
      await rows.first().click();
      await page.waitForTimeout(2000);
      await shot(page, "quickstart-download");
      await page.goBack().catch(() => {});
      await page.waitForTimeout(600);
    } else {
      // Click first clickable card
      const card = page.locator("[class*='cursor-pointer']").filter({ hasText: /session|interview/i }).first();
      if (await card.isVisible({ timeout: 2000 }).catch(() => false)) {
        await card.click();
        await page.waitForTimeout(2000);
        await shot(page, "quickstart-download");
        await page.goBack().catch(() => {});
      } else {
        await shot(page, "quickstart-download");
      }
    }
  }

  // ── 11. Batch CSV tab ─────────────────────────────────────────────────────
  console.log("§ Batch CSV tab");
  await page.goto(`${BASE}/internal/docufill?tab=csv`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2500);
  await dismissBanner(page);
  await shot(page, "batch-runs-list");
  await shot(page, "batch-runs-dashboard");

  // ── 12. Batch CSV — import sub-steps ─────────────────────────────────────
  console.log("§ Batch CSV sub-tabs");
  {
    const newBatch = page.getByRole("button", { name: /new batch|import|start.*batch/i }).first();
    const has = await newBatch.isVisible({ timeout: 3000 }).catch(() => false);
    if (has) {
      await newBatch.click();
      await page.waitForTimeout(1500);
      await shot(page, "batch-upload-step");
      // Try to advance to next step
      const nextBtn = page.getByRole("button", { name: /next|continue|upload|preview/i }).first();
      if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(1000);
      }
      await shot(page, "batch-template-preview");
      if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(1000);
      }
      await shot(page, "batch-progress");
      await shot(page, "batch-errors");
      await page.keyboard.press("Escape").catch(() => {});
    } else {
      await shot(page, "batch-upload-step");
      await shot(page, "batch-template-preview");
      await shot(page, "batch-progress");
      await shot(page, "batch-errors");
    }
  }

  // ── 13. Field Library / Groups tab ────────────────────────────────────────
  console.log("§ Field Library");
  // The Groups tab is in the left sidebar of the Package Builder
  await page.goto(`${BASE}/internal/docufill?tab=groups`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2500);
  await dismissBanner(page);
  await shot(page, "field-library-list");

  // ── 14. Add library fields ────────────────────────────────────────────────
  console.log("§ Add library fields");
  {
    const addBtn = page.getByRole("button", { name: /new group|add.*group|create.*group|add field/i }).first();
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(1000);
      await shot(page, "add-library-fields");
      await page.keyboard.press("Escape").catch(() => {});
    } else {
      await shot(page, "add-library-fields");
    }
  }

  // ── 15. Public interview form ─────────────────────────────────────────────
  console.log("§ Public interview form");
  {
    // Get a session token from the API
    const sessRes = await page.request.get(`${BASE}/api/internal/docufill/sessions`);
    let token: string | null = null;
    if (sessRes.ok()) {
      const sessions = await sessRes.json() as Array<{ token: string; status: string }>;
      const valid = sessions.find((s) => s.status !== "voided" && s.token);
      token = valid?.token ?? null;
    }
    const interviewUrl = token
      ? `${BASE}/docufill/${token}`
      : `${BASE}/docuplete/public/df_RSz5mLa3o893`;
    await page.goto(interviewUrl);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);
    await dismissBanner(page);
    await shot(page, "quickstart-interview");
    await shot(page, "client-interview");
    // Look for e-sign capture
    const signBtn = page.getByRole("button", { name: /sign|draw|signature/i }).first();
    if (await signBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await signBtn.click();
      await page.waitForTimeout(1000);
    }
    await shot(page, "esign-capture");
  }

  await ctx1.close();

  // ────────────────────────────────────────────────────────────────────────
  // PART 2: Settings screenshots via Clerk auth (7 screenshots)
  // ────────────────────────────────────────────────────────────────────────
  console.log("\n§ App settings (Clerk auth)");

  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page2 = await ctx2.newPage();

  try {
    const ticket = await getClerkTicket(SETTINGS_CLERK_USER);

    // Sign in via the Clerk ticket at the LOCAL app sign-in page
    await page2.goto(`${BASE}/app/sign-in?__clerk_ticket=${ticket}`);
    await page2.waitForLoadState("domcontentloaded");
    await page2.waitForTimeout(6000);
    console.log("  After ticket sign-in:", page2.url());

    // Navigate to settings
    await page2.goto(`${BASE}/app/settings`);
    await page2.waitForLoadState("domcontentloaded");
    await page2.waitForTimeout(5000);
    console.log("  Settings URL:", page2.url());

    // If still on sign-in or showing onboarding, check and handle
    const currentUrl = page2.url();
    if (currentUrl.includes("sign-in")) {
      console.log("  Still on sign-in. Checking if we need to complete onboarding...");
    }

    // Check if we have a company name input (onboarding form)
    const companyInput = page2.getByRole("textbox", { name: /company|organization/i }).first();
    const isOnboarding = await companyInput.isVisible({ timeout: 3000 }).catch(() => false);
    if (isOnboarding) {
      console.log("  Completing onboarding form...");
      await companyInput.fill("Acme Financial Services");
      await page2.waitForTimeout(500);
      // Submit the form
      const submitBtn = page2.getByRole("button", { name: /continue|submit|get started|create/i }).first();
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click();
        await page2.waitForTimeout(3000);
      }
      await page2.goto(`${BASE}/app/settings`);
      await page2.waitForLoadState("domcontentloaded");
      await page2.waitForTimeout(5000);
    }

    console.log("  Final settings URL:", page2.url());

    // Take screenshots of settings sections using scroll
    // First: top of settings (org/branding section)
    await page2.evaluate(() => { window.scrollTo(0, 0); });
    await shot(page2, "branding-settings");

    // Scroll to API keys
    await page2.evaluate(() => {
      const el = document.querySelector("#api-keys-section, [data-section='api-keys']") as HTMLElement | null;
      if (el) { el.scrollIntoView({ behavior: "instant", block: "start" }); }
      else { window.scrollBy(0, 700); }
    });
    await shot(page2, "api-keys-panel");

    // Scroll to channels / interview defaults
    await page2.evaluate(() => {
      const el = document.querySelector("#interview-defaults-section, [data-section='channels']") as HTMLElement | null;
      if (el) { el.scrollIntoView({ behavior: "instant", block: "start" }); }
      else { window.scrollBy(0, 700); }
    });
    await shot(page2, "channels-config");

    // Scroll to integrations
    await page2.evaluate(() => {
      const el = document.querySelector("#integrations-section, [data-section='integrations']") as HTMLElement | null;
      if (el) { el.scrollIntoView({ behavior: "instant", block: "start" }); }
      else { window.scrollBy(0, 700); }
    });
    await shot(page2, "google-drive-settings");

    await page2.evaluate(() => { window.scrollBy(0, 500); });
    await page2.waitForTimeout(400);
    await shot(page2, "hubspot-field-mapping");

    // Scroll to developer / webhooks
    await page2.evaluate(() => {
      const el = document.querySelector("#developer-section, [data-section='developer'], [data-section='webhooks']") as HTMLElement | null;
      if (el) { el.scrollIntoView({ behavior: "instant", block: "start" }); }
      else { window.scrollBy(0, 700); }
    });
    await shot(page2, "webhook-setup");

    await page2.evaluate(() => { window.scrollBy(0, 600); });
    await page2.waitForTimeout(400);
    await shot(page2, "webhook-logs");

  } catch (e) {
    console.warn("  ! Settings screenshots failed:", e instanceof Error ? e.message : String(e));
    // Fall back: capture settings page in whatever state it's in
    for (const name of ["branding-settings", "api-keys-panel", "channels-config", "google-drive-settings", "hubspot-field-mapping", "webhook-setup", "webhook-logs"]) {
      await shot(page2, name);
    }
  }

  await ctx2.close();
  await browser.close();
  console.log("\nAll 29 screenshots saved to", OUT);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
