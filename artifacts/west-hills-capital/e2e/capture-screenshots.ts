/**
 * Docuplete docs screenshot capture — all 29 illustrations.
 * Run: PORT=23904 tsx artifacts/west-hills-capital/e2e/capture-screenshots.ts
 */
import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const PORT  = process.env.PORT ?? "23904";
const BASE  = `http://localhost:${PORT}`;
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY ?? "";
const SETTINGS_USER    = "user_3Cy2T6MdbIhWuKdUF7Yx06arfD1";
const NIX_CHROME = "/nix/store/d7y5039fgn5432kgkn0cv09hda4a7nxz-playwright-chromium-cjk-1.55.0-1187/chrome-linux/chrome";
const OUT = path.resolve(__dirname, "../../../artifacts/docuplete-docs/public/screenshots");

fs.mkdirSync(OUT, { recursive: true });
type Page = import("playwright").Page;

async function shot(page: Page, name: string) {
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  console.log(`  ✓ ${name}.png`);
}

async function dismissBanner(page: Page) {
  const btn = page.getByRole("button", { name: /^accept$/i });
  if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(300);
  }
}

async function dismissOverlay(page: Page) {
  const skip = page.locator("text=Skip, explore the builder");
  if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) {
    await skip.click();
    await page.waitForTimeout(400);
  }
}

/** Navigate with base setup */
async function nav(page: Page, url: string, wait = 2500) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(wait);
  await dismissBanner(page);
  await dismissOverlay(page);
}

/**
 * Navigate to DocuFill page with a specific tab set via sessionStorage.
 * sessionStorage persists across navigations in the same tab, so we set it
 * BEFORE the navigation, then navigate, then the React app reads it on init.
 */
async function navDocuFillTab(page: Page, tabValue: string, extraParams = "") {
  // Pre-set the session key so React initialises with the correct tab
  await page.evaluate((tab) => {
    try { sessionStorage.setItem("docufill:tab", tab); } catch {}
  }, tabValue);
  await page.goto(`${BASE}/internal/docufill?packageId=183${extraParams}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await dismissBanner(page);
  await dismissOverlay(page);
}

async function scrollBy(page: Page, y: number) {
  await page.evaluate((dy) => window.scrollBy(0, dy), y);
  await page.waitForTimeout(400);
}

async function scrollTo(page: Page, id: string, extraY = 0) {
  await page.evaluate((sid) => {
    const el = document.getElementById(sid);
    if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
    else window.scrollTo(0, 0);
  }, id);
  if (extraY) await page.evaluate((y) => window.scrollBy(0, y), extraY);
  await page.waitForTimeout(600);
}

async function getClerkTicket(): Promise<string | null> {
  if (!CLERK_SECRET_KEY) return null;
  try {
    const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
      method: "POST",
      headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: SETTINGS_USER, expires_in_seconds: 600 }),
    });
    if (!res.ok) { console.warn("  ! Clerk ticket error:", res.status); return null; }
    const data = await res.json() as { url: string };
    return new URL(data.url).searchParams.get("__clerk_ticket");
  } catch (e) { console.warn("  ! Clerk ticket fetch failed:", e); return null; }
}

async function main() {
  console.log("Seeding demo data…");
  await fetch(`${BASE}/api/internal/docufill/seed-demo`, { method: "POST" }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2000));

  const browser = await chromium.launch({
    executablePath: NIX_CHROME,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PART 1 — dashboard-overview: fresh context, no package selected
  // ─────────────────────────────────────────────────────────────────────────
  console.log("§1 dashboard-overview");
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem("docufill:demo-ui", "dismissed");
        // Clear tab so it shows default packages view
        sessionStorage.removeItem("docufill:tab");
      } catch {}
    });
    const p = await ctx.newPage();
    await nav(p, `${BASE}/internal/docufill`, 3500);
    // Scroll slightly to show the package list below the nav
    await p.evaluate(() => window.scrollBy(0, 80));
    await p.waitForTimeout(400);
    await shot(p, "dashboard-overview");
    await ctx.close();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PART 2 — Main DocuFill screenshots
  // ─────────────────────────────────────────────────────────────────────────
  const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx1.addInitScript(() => {
    try { localStorage.setItem("docufill:demo-ui", "dismissed"); } catch {}
  });
  const page = await ctx1.newPage();

  // ── 2. quickstart-upload: Documents step, showing the upload zone ────────
  console.log("§2 quickstart-upload");
  await navDocuFillTab(page, "packages");
  await shot(page, "quickstart-upload");

  // ── 3. upload-dialog: scroll to show the PDF drop-zone / doc list area ──
  console.log("§3 upload-dialog");
  await scrollBy(page, 320);
  await shot(page, "upload-dialog");

  // ── 4. field-editor: Documents step — show content mid-page ─────────────
  console.log("§4 field-editor");
  await scrollBy(page, 180);
  await shot(page, "field-editor");

  // ── 5–8. Mapper: click "Map Fields" step button to enter mapper tab ─────
  console.log("§5 mapper-overview");
  // Re-navigate to packages tab then click Map Fields
  await navDocuFillTab(page, "packages");
  await page.waitForTimeout(500);
  const mapBtn = page.locator("button").filter({ hasText: /Map Fields/ }).first();
  if (await mapBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await mapBtn.click();
    await page.waitForTimeout(5000); // PDF takes time to render
  }
  await shot(page, "mapper-overview");

  console.log("§6 quickstart-mapper");
  // Scroll the page down to show a different area of the mapper
  await page.evaluate(() => {
    // Scroll the main scrollable container (not window, but the flex layout)
    const main = document.querySelector("main, [class*='overflow-y']");
    if (main) (main as HTMLElement).scrollTop += 300;
    else window.scrollBy(0, 300);
  });
  await page.waitForTimeout(600);
  await shot(page, "quickstart-mapper");

  console.log("§7 esign-field-placed");
  // Try clicking on different canvas positions to select a placed field
  // Fields tend to be in the document content area (upper-right quadrant of PDF)
  for (const [x, y] of [[350, 250], [300, 350], [400, 300], [250, 200], [500, 400]]) {
    await page.mouse.click(x, y);
    await page.waitForTimeout(400);
  }
  // Scroll right panel back to top to show any config that appeared
  await page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll("[class*='overflow-y-auto']"));
    panels.forEach((p) => { if ((p as HTMLElement).getBoundingClientRect().left > 640) (p as HTMLElement).scrollTop = 0; });
  });
  await page.waitForTimeout(600);
  await shot(page, "esign-field-placed");

  console.log("§8 textbox-config");
  // Scroll the overall page down a bit to show a different viewport position
  await page.evaluate(() => {
    const main = document.querySelector("main, [class*='overflow-y']");
    if (main) (main as HTMLElement).scrollTop += 150;
    else window.scrollBy(0, 150);
  });
  await page.waitForTimeout(500);
  await shot(page, "textbox-config");

  // ── 9–11. Interviews tab ─────────────────────────────────────────────────
  console.log("§9 interviews-list");
  // Use sessionStorage tab + URL param ?tab=sessions for redundancy
  await page.evaluate(() => { try { sessionStorage.setItem("docufill:tab", "interview"); } catch {} });
  await nav(page, `${BASE}/internal/docufill?packageId=183&tab=sessions`, 3500);
  // Click "Interview Dashboard" sub-tab to show the session history table
  const interviewDashBtn = page.locator("button").filter({ hasText: /Interview Dashboard/ }).first();
  if (await interviewDashBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await interviewDashBtn.click({ force: true });
    await page.waitForTimeout(1000);
  }
  await shot(page, "interviews-list");

  console.log("§10 create-session-dialog");
  // Switch to Interviews sub-tab to show the form (package picker + Start Interview button)
  const interviewsTab = page.locator("button").filter({ hasText: /^Interviews$/ }).first();
  if (await interviewsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await interviewsTab.click({ force: true });
    await page.waitForTimeout(800);
  }
  // Try clicking "Send by email" to show the email form
  const sendByEmail = page.locator("button").filter({ hasText: /send by email/i }).first();
  if (await sendByEmail.isVisible({ timeout: 2000 }).catch(() => false)) {
    await sendByEmail.click({ force: true });
    await page.waitForTimeout(800);
  }
  await shot(page, "create-session-dialog");

  console.log("§11 quickstart-download");
  // Navigate to session history in Interview Dashboard
  await page.evaluate(() => { try { sessionStorage.setItem("docufill:tab", "interview"); } catch {} });
  await nav(page, `${BASE}/internal/docufill?packageId=183&tab=sessions`, 3000);
  // Click session history table sub-tab
  const dashBtn2 = page.locator("button").filter({ hasText: /Interview Dashboard/ }).first();
  if (await dashBtn2.isVisible({ timeout: 2000 }).catch(() => false)) {
    await dashBtn2.click({ force: true });
    await page.waitForTimeout(1200);
  }
  await scrollBy(page, 200);
  await shot(page, "quickstart-download");

  // ── 12–17. Batch CSV tab (set via sessionStorage) ─────────────────────────
  console.log("§12 batch-upload-step");
  await navDocuFillTab(page, "csv");
  // Default sub-tab is "import" — shows file upload interface
  await shot(page, "batch-upload-step");

  console.log("§13 batch-template-preview");
  await scrollBy(page, 280);
  await shot(page, "batch-template-preview");

  console.log("§14 batch-runs-list");
  // Click "Batch Dashboard" sub-tab (within CSV tab)
  const batchDashBtn = page.locator("button").filter({ hasText: /Batch Dashboard/ }).first();
  if (await batchDashBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await batchDashBtn.click({ force: true });
    await page.waitForTimeout(1500);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await shot(page, "batch-runs-list");

  console.log("§15 batch-runs-dashboard");
  await scrollBy(page, 300);
  await shot(page, "batch-runs-dashboard");

  console.log("§16-17 batch-progress / batch-errors");
  // Switch back to Import sub-tab
  const importBtn = page.locator("button").filter({ hasText: /^Import$/ }).first();
  if (await importBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await importBtn.click({ force: true });
    await page.waitForTimeout(1000);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await shot(page, "batch-progress");
  await scrollBy(page, 450);
  await shot(page, "batch-errors");

  // ── 18–19. Field Library (groups tab via sessionStorage) ─────────────────
  console.log("§18 field-library-list");
  await navDocuFillTab(page, "groups");
  await shot(page, "field-library-list");

  console.log("§19 add-library-fields");
  await scrollBy(page, 200);
  await shot(page, "add-library-fields");

  // ── 20–22. Public interview form ────────────────────────────────────────
  console.log("§20-22 public interview");
  const SESSION_TOKEN = "df_3iQhuYil5yYEpI9dkJwzHEyTeWJ-F0qzw6Cg8wE_tZw";
  await nav(page, `${BASE}/docufill/${SESSION_TOKEN}`, 5000);
  await shot(page, "quickstart-interview");

  await scrollBy(page, 350);
  await shot(page, "client-interview");

  // Scroll much further for esign-capture (form bottom / submit / final section)
  await scrollBy(page, 600);
  // Look for a sign button or just show the bottom of the form
  const signBtn = page.locator("button").filter({ hasText: /sign|draw|e-sign|signature/i }).first();
  if (await signBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await signBtn.click({ force: true });
    await page.waitForTimeout(1200);
  }
  await shot(page, "esign-capture");

  await ctx1.close();

  // ─────────────────────────────────────────────────────────────────────────
  // PART 3 — App Settings (7 screenshots) via Clerk ticket + route mocks
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n§ Settings screenshots");

  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page2 = await ctx2.newPage();

  // Route mocks (must be before navigation)
  await page2.route("**/api/v1/product/auth/me", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      accountId: 4, accountName: "Acme Financial Services", slug: "acme-financial",
      email: "admin@acme.com", role: "admin", orgLogoUrl: null,
    }) })
  );
  await page2.route("**/api/v1/product/settings/integrations", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      storage: { provider: "google_drive", connected: true, email: "ops@acme.com", folder_name: "Docuplete Uploads",
        available: { google_drive: true, onedrive: true, dropbox: true } },
      hubspot: { connected: true, hub_domain: "acme.hubspot.com" },
      slack: { connected: false, channel_name: null },
      gdrive: { connected: true, email: "ops@acme.com", folder_name: "Docuplete Uploads" },
    }) })
  );
  await page2.route("**/api/v1/product/settings/api-keys", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ keys: [
      { id: 1, name: "Production", prefix: "sk_live_Kx3A…", created_at: "2025-01-15T10:00:00Z", last_used_at: "2025-05-01T08:23:00Z" },
      { id: 2, name: "Development", prefix: "sk_live_Mf7P…", created_at: "2025-03-10T09:00:00Z", last_used_at: null },
    ] }) })
  );
  await page2.route("**/api/v1/product/settings/webhooks**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ webhooks: [
      { id: 1, url: "https://api.acme.com/hooks/docuplete", events: ["session.completed", "session.submitted"], active: true, created_at: "2025-02-01T00:00:00Z" },
    ], logs: [
      { id: 1, event: "session.completed", status: "success", duration_ms: 142, attempted_at: "2025-05-01T10:23:00Z" },
      { id: 2, event: "session.submitted", status: "success", duration_ms: 89,  attempted_at: "2025-05-01T09:12:00Z" },
    ] }) })
  );
  await page2.route("**/api/v1/product/settings/audit-log**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ entries: [
      { id: 1, action: "api_key.created", actor_email: "admin@acme.com", created_at: "2025-05-01T10:00:00Z", metadata: {} },
      { id: 2, action: "webhook.created", actor_email: "admin@acme.com", created_at: "2025-04-20T09:15:00Z", metadata: {} },
      { id: 3, action: "member.invited", actor_email: "admin@acme.com", created_at: "2025-04-15T14:30:00Z", metadata: { email: "analyst@acme.com" } },
    ] }) })
  );
  await page2.route("**/api/v1/product/settings/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) })
  );
  await page2.route("**/api/v1/product/auth/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) })
  );

  // Clerk ticket sign-in
  const ticket = await getClerkTicket();
  if (ticket) {
    console.log("  Signing in via Clerk ticket…");
    await page2.goto(`${BASE}/app/sign-in?__clerk_ticket=${ticket}`, { waitUntil: "domcontentloaded" });
    await page2.waitForTimeout(9000);
    console.log("  After ticket:", page2.url());
  }

  await page2.goto(`${BASE}/app/settings`, { waitUntil: "domcontentloaded" });
  await page2.waitForTimeout(9000);
  console.log("  Settings URL:", page2.url());

  // Section order from top to bottom in AppSettings:
  // organization-section → interview-defaults-section → integrations-section
  // → developer-section (DeveloperSection component = webhooks/SDK)
  //   → api-keys-section (inside developer-section, below DeveloperSection)
  // → data-privacy-section → audit-log-section
  const settingsSections: Array<[string, string, number]> = [
    ["organization-section",       "branding-settings",    0],
    ["interview-defaults-section", "channels-config",      0],
    ["integrations-section",       "google-drive-settings",0],
    ["integrations-section",       "hubspot-field-mapping",600],
    ["developer-section",          "webhook-setup",        0],
    ["api-keys-section",           "api-keys-panel",       0],
    ["audit-log-section",          "webhook-logs",         0],
  ];

  for (const [sectionId, name, extraY] of settingsSections) {
    await scrollTo(page2, sectionId, extraY);
    await shot(page2, name);
  }

  await ctx2.close();
  await browser.close();
  console.log(`\nDone — 29 screenshots in ${OUT}`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
