/**
 * Settings screenshot capture — uses Clerk sign-in token to authenticate,
 * then captures /app/settings sections.
 *
 * Requires: CLERK_SECRET_KEY env var (already set in this environment)
 * Run: PORT=23904 tsx artifacts/west-hills-capital/e2e/capture-settings-screenshots.ts
 */
import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ?? "23904";
const BASE = `http://localhost:${PORT}`;
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY ?? "";
const CLERK_USER_ID = "user_3DKGMH3VzAdFRPT94OhYM4UbWGM";
const NIX_CHROME = "/nix/store/d7y5039fgn5432kgkn0cv09hda4a7nxz-playwright-chromium-cjk-1.55.0-1187/chrome-linux/chrome";

// Resolve output path relative to workspace root
const OUT = path.resolve(__dirname, "../../..", "artifacts/docuplete-docs/public/screenshots");
fs.mkdirSync(OUT, { recursive: true });

async function createSignInToken(): Promise<string> {
  const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: CLERK_USER_ID,
      expires_in_seconds: 600,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to create sign-in token: ${res.status} ${body}`);
  }
  const data = await res.json() as { url: string };
  return data.url;
}

async function shot(page: import("playwright").Page, name: string) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);
  const dest = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: dest, fullPage: false });
  console.log(`  ✓ ${name}.png`);
}

async function scrollTo(page: import("playwright").Page, selector: string) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
  }, selector);
  await page.waitForTimeout(600);
}

async function main() {
  if (!CLERK_SECRET_KEY) {
    throw new Error("CLERK_SECRET_KEY is required");
  }

  console.log("Creating Clerk sign-in token...");
  const signInUrl = await createSignInToken();
  console.log("Sign-in URL obtained. Launching browser...");

  const browser = await chromium.launch({
    executablePath: NIX_CHROME,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // Step 1: Extract the __clerk_ticket from the sign-in URL
  // The Clerk API returns: https://large-tahr-52.accounts.dev/sign-in?__clerk_ticket=<token>
  // We use the ticket with the LOCAL app sign-in page so Clerk processes it in-app
  const ticketParam = new URL(signInUrl).searchParams.get("__clerk_ticket") ?? "";
  if (!ticketParam) throw new Error("No __clerk_ticket found in sign-in URL: " + signInUrl);

  const localSignInUrl = `${BASE}/app/sign-in?__clerk_ticket=${ticketParam}`;
  console.log("Navigating to local app sign-in with ticket...");
  await page.goto(localSignInUrl);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(5000);

  console.log("After ticket sign-in, current URL:", page.url());

  // Navigate to the settings page
  console.log("Navigating to /app/settings...");
  await page.goto(`${BASE}/app/settings`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(5000);

  console.log("Settings URL:", page.url());

  // Check if we're actually on the settings page
  const onSettings = await page.locator("h1, h2").filter({ hasText: /settings/i }).isVisible().catch(() => false);
  console.log("On settings page:", onSettings);

  if (!onSettings) {
    console.log("Not on settings page yet. Current URL:", page.url());
    // Wait a bit more for Clerk to establish session
    await page.waitForTimeout(3000);
    await page.goto(`${BASE}/app/settings`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(5000);
    console.log("Final attempt URL:", page.url());
  }

  console.log("Final URL:", page.url());
  console.log("§ Settings — capturing screenshots...");

  // ── Branding section ─────────────────────────────────────────────────────
  await scrollTo(page, "#organization-section, [id*='org'], [id*='brand']");
  await shot(page, "branding-settings");

  // ── API Keys section ──────────────────────────────────────────────────────
  await scrollTo(page, "#api-keys-section, [id*='api-key']");
  await shot(page, "api-keys-panel");

  // ── Channels section (interview defaults) ─────────────────────────────────
  await scrollTo(page, "#interview-defaults-section, [id*='channel'], [id*='interview-default']");
  await shot(page, "channels-config");

  // ── Integrations — Google Drive ───────────────────────────────────────────
  await scrollTo(page, "#integrations-section, [id*='integrations']");
  await shot(page, "google-drive-settings");

  // Scroll down within integrations for HubSpot
  await page.evaluate(() => { window.scrollBy(0, 400); });
  await page.waitForTimeout(600);
  await shot(page, "hubspot-field-mapping");

  // ── Developer / Webhooks ──────────────────────────────────────────────────
  await scrollTo(page, "#developer-section, [id*='developer'], [id*='webhook']");
  await shot(page, "webhook-setup");

  // Scroll down for webhook logs
  await page.evaluate(() => { window.scrollBy(0, 500); });
  await page.waitForTimeout(600);
  await shot(page, "webhook-logs");

  await browser.close();
  console.log("\nSettings screenshots complete. Files saved to:", OUT);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
