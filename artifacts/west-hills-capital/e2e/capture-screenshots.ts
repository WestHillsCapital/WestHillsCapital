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
  // Use wider viewport so the PDF canvas is ~160px wider — visually distinct from §5/§6
  await page.setViewportSize({ width: 1440, height: 900 });
  // Re-navigate to mapper at new width (forces re-render at wider proportions)
  await navDocuFillTab(page, "mapper");
  await page.waitForTimeout(3000); // PDF needs time to render at new size
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  await shot(page, "esign-field-placed");
  // Restore viewport for subsequent screenshots
  await page.setViewportSize({ width: 1280, height: 800 });

  console.log("§8 textbox-config");
  // Navigate to packages tab and click the "Finalize" step to show interview/finalize config
  // This is completely different content from the mapper PDF canvas view
  await navDocuFillTab(page, "packages");
  await page.waitForTimeout(500);
  // Click the "Finalize" step button (3rd step in the Package Builder wizard)
  const finalizeBtn = page.locator("button").filter({ hasText: /Finalize/ }).first();
  if (await finalizeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await finalizeBtn.click();
    await page.waitForTimeout(1500);
  }
  await shot(page, "textbox-config");

  // ── 9–11. Interviews tab ─────────────────────────────────────────────────
  // IMPORTANT: navigate with ?tab=sessions URL param to reach the interview tab —
  // sessionStorage.setItem() on an about:blank page silently fails because the
  // origin doesn't match.  The URL param is read directly by the useState init.
  //
  // Mock the portal-list sessions API so the Interview Dashboard shows populated rows.
  // 10 sessions ensures scroll 0 vs scroll 220 shows visually different rows.
  const PORTAL_SESSIONS = [
    { token: "ps01", package_id: 183, package_name: "Demo — Client Information", status: "generated",
      source: "staff", created_at: "2025-05-06T09:00:00Z", signer_name: "Alice Huang",
      signer_email: "alice@acmefin.com", signed_at: "2025-05-06T09:30:00Z",
      submitted_at: "2025-05-06T09:30:00Z", link_emailed_at: "2025-05-06T09:01:00Z",
      link_email_recipient: "alice@acmefin.com" },
    { token: "ps02", package_id: 183, package_name: "Demo — Client Information", status: "signed",
      source: "staff", created_at: "2025-05-06T09:05:00Z", signer_name: "Robert Kim",
      signer_email: "rkim@acmefin.com", signed_at: "2025-05-06T10:12:00Z",
      submitted_at: "2025-05-06T10:12:00Z", link_emailed_at: "2025-05-06T09:06:00Z",
      link_email_recipient: "rkim@acmefin.com" },
    { token: "ps03", package_id: 183, package_name: "Demo — Client Information", status: "submitted",
      source: "customer", created_at: "2025-05-05T14:00:00Z", signer_name: "Maria Santos",
      signer_email: "msantos@acmefin.com", signed_at: null,
      submitted_at: "2025-05-05T14:45:00Z", link_emailed_at: "2025-05-05T14:01:00Z",
      link_email_recipient: "msantos@acmefin.com" },
    { token: "ps04", package_id: 183, package_name: "Demo — Client Information", status: "generated",
      source: "staff", created_at: "2025-05-05T11:00:00Z", signer_name: "James Okafor",
      signer_email: "jokafor@corp.com", signed_at: "2025-05-05T11:55:00Z",
      submitted_at: "2025-05-05T11:55:00Z", link_emailed_at: "2025-05-05T11:01:00Z",
      link_email_recipient: "jokafor@corp.com" },
    { token: "ps05", package_id: 183, package_name: "Demo — Client Information", status: "draft",
      source: "staff", created_at: "2025-05-05T10:00:00Z", signer_name: "Elena Morozova",
      signer_email: "emorozova@acmefin.com", signed_at: null,
      submitted_at: null, link_emailed_at: null, link_email_recipient: null },
    { token: "ps06", package_id: 183, package_name: "Demo — Client Information", status: "submitted",
      source: "customer", created_at: "2025-05-04T16:00:00Z", signer_name: "David Patel",
      signer_email: "dpatel@acmefin.com", signed_at: null,
      submitted_at: "2025-05-04T16:40:00Z", link_emailed_at: "2025-05-04T16:01:00Z",
      link_email_recipient: "dpatel@acmefin.com" },
    { token: "ps07", package_id: 183, package_name: "Demo — Client Information", status: "generated",
      source: "staff", created_at: "2025-05-04T13:00:00Z", signer_name: "Yuki Tanaka",
      signer_email: "ytanaka@acmefin.com", signed_at: "2025-05-04T13:50:00Z",
      submitted_at: "2025-05-04T13:50:00Z", link_emailed_at: "2025-05-04T13:01:00Z",
      link_email_recipient: "ytanaka@acmefin.com" },
    { token: "ps08", package_id: 183, package_name: "Demo — Client Information", status: "submitted",
      source: "customer", created_at: "2025-05-03T10:00:00Z", signer_name: "Fatima Al-Rashid",
      signer_email: "falrashid@acmefin.com", signed_at: null,
      submitted_at: "2025-05-03T10:30:00Z", link_emailed_at: "2025-05-03T10:01:00Z",
      link_email_recipient: "falrashid@acmefin.com" },
    { token: "ps09", package_id: 183, package_name: "Demo — Client Information", status: "draft",
      source: "staff", created_at: "2025-05-02T15:00:00Z", signer_name: "Carlos Mendez",
      signer_email: "cmendez@acmefin.com", signed_at: null,
      submitted_at: null, link_emailed_at: "2025-05-02T15:01:00Z", link_email_recipient: "cmendez@acmefin.com" },
    { token: "ps10", package_id: 183, package_name: "Demo — Client Information", status: "generated",
      source: "staff", created_at: "2025-05-01T09:00:00Z", signer_name: "Sara Johansson",
      signer_email: "sjohansson@acmefin.com", signed_at: "2025-05-01T09:45:00Z",
      submitted_at: "2025-05-01T09:45:00Z", link_emailed_at: "2025-05-01T09:01:00Z",
      link_email_recipient: "sjohansson@acmefin.com" },
  ];
  await page.route("**/sessions/portal-list**", (route) =>
    route.fulfill({ contentType: "application/json",
      body: JSON.stringify({ sessions: PORTAL_SESSIONS, total: PORTAL_SESSIONS.length }) })
  );

  console.log("§9 interviews-list");
  // Use sessionStorage tab + URL param ?tab=sessions for redundancy
  await page.evaluate(() => { try { sessionStorage.setItem("docufill:tab", "interview"); } catch {} });
  await nav(page, `${BASE}/internal/docufill?packageId=183&tab=sessions`, 3500);
  // Click "Interview Dashboard" sub-tab to show the session history table (now populated)
  const interviewDashBtn = page.locator("button").filter({ hasText: /Interview Dashboard/ }).first();
  if (await interviewDashBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await interviewDashBtn.click({ force: true });
    await page.waitForTimeout(1200);
  }
  await shot(page, "interviews-list");

  console.log("§10 create-session-dialog");
  // Navigate fresh to interview tab — React re-initialises interviewSubTab to "interviews"
  // (the form view with package picker / Send by email), visually distinct from the §9 session table.
  // NOTE: the "Interviews" button in the main nav bar has the same text as the sub-tab button.
  //       Using .first() accidentally clicks the main-nav button (no state change), so we
  //       navigate instead to force a clean re-initialisation.
  await nav(page, `${BASE}/internal/docufill?packageId=183&tab=sessions`, 4500);
  // Stay on the default "Interviews" sub-tab — no extra click needed.
  await shot(page, "create-session-dialog");

  console.log("§11 quickstart-download");
  // Navigate to Interview Dashboard — scroll 220px to show bottom rows of populated session table
  // (rows 5-10 visible at top instead of rows 1-5 at scroll 0)
  await page.evaluate(() => { try { sessionStorage.setItem("docufill:tab", "interview"); } catch {} });
  await nav(page, `${BASE}/internal/docufill?packageId=183&tab=sessions`, 3000);
  const dashBtn2 = page.locator("button").filter({ hasText: /Interview Dashboard/ }).first();
  if (await dashBtn2.isVisible({ timeout: 2000 }).catch(() => false)) {
    await dashBtn2.click({ force: true });
    await page.waitForTimeout(1200);
  }
  // Scroll to show different rows than §9 (rows 5–10 instead of rows 1–5)
  await page.evaluate(() => window.scrollBy(0, 220));
  await page.waitForTimeout(500);
  await shot(page, "quickstart-download");

  // Clean up sessions route mock
  await page.unroute("**/sessions/portal-list**");

  // ── 12–17. Batch CSV tab (set via sessionStorage) ─────────────────────────
  console.log("§12 batch-upload-step");
  await navDocuFillTab(page, "csv");
  // Default sub-tab is "import" — shows file upload interface with no package selected
  await shot(page, "batch-upload-step");

  console.log("§13 batch-template-preview");
  // Select package 183 from the dropdown — reveals "Download blank template" link + field reference
  const csvPackageSelect = page.locator("select").filter({ hasText: /Select active package/i }).first();
  if (await csvPackageSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    await csvPackageSelect.selectOption("183");
    await page.waitForTimeout(1200);
  }
  await shot(page, "batch-template-preview");

  // ── §14-17: Batch Dashboard with mocked batch run data ───────────────────
  // Mock batch-runs API so the dashboard shows real-looking data instead of empty state.
  // Two separate mock states are needed:
  //   State A: 2 completed runs (for batch-runs-list + batch-runs-dashboard)
  //   State B: 1 in-progress run (for batch-progress + batch-errors)

  const COMPLETED_SESSIONS = [
    { token: "tok1", package_id: 183, package_name: "Demo — Client Information", status: "completed",
      source: "csv_batch", created_at: "2025-05-01T10:01:00Z", signer_name: "Alice Huang",
      signer_email: "alice@acmefin.com", signed_at: "2025-05-01T10:15:00Z",
      submitted_at: "2025-05-01T10:15:00Z", link_emailed_at: "2025-05-01T10:02:00Z",
      link_email_recipient: "alice@acmefin.com" },
    { token: "tok2", package_id: 183, package_name: "Demo — Client Information", status: "completed",
      source: "csv_batch", created_at: "2025-05-01T10:01:30Z", signer_name: "Robert Kim",
      signer_email: "rkim@acmefin.com", signed_at: "2025-05-01T11:02:00Z",
      submitted_at: "2025-05-01T11:02:00Z", link_emailed_at: "2025-05-01T10:02:30Z",
      link_email_recipient: "rkim@acmefin.com" },
    { token: "tok3", package_id: 183, package_name: "Demo — Client Information", status: "pending",
      source: "csv_batch", created_at: "2025-05-01T10:02:00Z", signer_name: "Maria Santos",
      signer_email: "msantos@acmefin.com", signed_at: null, submitted_at: null,
      link_emailed_at: "2025-05-01T10:03:00Z", link_email_recipient: "msantos@acmefin.com" },
  ];
  const ERROR_SESSIONS = [
    { token: "tok4", package_id: 183, package_name: "Demo — Client Information", status: "completed",
      source: "csv_batch", created_at: "2025-05-06T09:16:00Z", signer_name: "James Okafor",
      signer_email: "jokafor@corp.com", signed_at: "2025-05-06T09:45:00Z",
      submitted_at: "2025-05-06T09:45:00Z", link_emailed_at: "2025-05-06T09:16:30Z",
      link_email_recipient: "jokafor@corp.com" },
    { token: "tok5", package_id: 183, package_name: "Demo — Client Information", status: "error",
      source: "csv_batch", created_at: "2025-05-06T09:16:30Z", signer_name: null,
      signer_email: "bad-email@@broken", signed_at: null, submitted_at: null,
      link_emailed_at: null, link_email_recipient: null },
  ];

  // State variable captured in route handler closure
  let batchRunsPayload = JSON.stringify({
    runs: [
      { batch_run_id: "run_20250501_abc1", run_started_at: "2025-05-01T10:00:00Z",
        package_name: "Demo — Client Information", package_id: 183,
        total: "12", pending: "0", completed: "10", emailed: "10" },
      { batch_run_id: "run_20250428_def2", run_started_at: "2025-04-28T14:30:00Z",
        package_name: "Demo — Client Information", package_id: 183,
        total: "7", pending: "0", completed: "7", emailed: "7" },
    ],
    total: 2,
  });
  let sessionsPayload: Record<string, string> = {
    "run_20250501_abc1": JSON.stringify({ sessions: COMPLETED_SESSIONS }),
    "run_20250506_xyz9": JSON.stringify({ sessions: ERROR_SESSIONS }),
  };

  await page.route("**/docufill/batch-runs**", (route) => {
    const url = route.request().url();
    // Session detail request: /batch-runs/<id>
    const sessionMatch = url.match(/\/batch-runs\/([^/?]+)/);
    if (sessionMatch) {
      const runId = sessionMatch[1];
      route.fulfill({ contentType: "application/json", body: sessionsPayload[runId] ?? JSON.stringify({ sessions: [] }) });
    } else {
      // List request: /batch-runs or /batch-runs?limit=50
      route.fulfill({ contentType: "application/json", body: batchRunsPayload });
    }
  });

  console.log("§14 batch-runs-list");
  // Click "Batch Dashboard" sub-tab — API is now mocked to return 2 completed runs
  const batchDashBtn = page.locator("button").filter({ hasText: /Batch Dashboard/ }).first();
  if (await batchDashBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await batchDashBtn.click({ force: true });
    await page.waitForTimeout(2000);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await shot(page, "batch-runs-list");

  console.log("§15 batch-runs-dashboard");
  // Click expand on the first run row to show the sessions table
  const firstRunBtn = page.locator("button").filter({ hasText: /Demo — Client Information/ }).first();
  if (await firstRunBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await firstRunBtn.click({ force: true });
    await page.waitForTimeout(1500);
  }
  await shot(page, "batch-runs-dashboard");

  console.log("§16 batch-progress");
  // Switch mock to return 1 in-progress run (pending > 0, lower % Done)
  batchRunsPayload = JSON.stringify({
    runs: [
      { batch_run_id: "run_20250506_xyz9", run_started_at: "2025-05-06T09:15:00Z",
        package_name: "Demo — Client Information", package_id: 183,
        total: "15", pending: "6", completed: "9", emailed: "9" },
    ],
    total: 1,
  });
  // Navigate fresh to CSV tab so the mocked Batch Dashboard reloads with new data
  await navDocuFillTab(page, "csv");
  const batchDashBtn2 = page.locator("button").filter({ hasText: /Batch Dashboard/ }).first();
  if (await batchDashBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
    await batchDashBtn2.click({ force: true });
    await page.waitForTimeout(2000);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await shot(page, "batch-progress");

  console.log("§17 batch-errors");
  // Expand the in-progress run row — sessions mock returns rows with error status
  const inProgressRunBtn = page.locator("button").filter({ hasText: /Demo — Client Information/ }).first();
  if (await inProgressRunBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await inProgressRunBtn.click({ force: true });
    await page.waitForTimeout(1500);
  }
  await shot(page, "batch-errors");

  // Remove the batch-runs route mock so it doesn't affect later requests
  await page.unroute("**/docufill/batch-runs**");

  // ── 18–19. Field Library screenshots ─────────────────────────────────────
  console.log("§18 field-library-list");
  // Groups tab: shows the "All Groups" EntityPanel (group management)
  await navDocuFillTab(page, "groups");
  await shot(page, "field-library-list");

  console.log("§19 add-library-fields");
  // Packages tab → open "Advanced lists and reusable fields" details
  // → scroll to show the FieldLibraryPanel ("Shared Field Library") — distinct from groups
  await navDocuFillTab(page, "packages");
  await page.waitForTimeout(500);
  // Open the "Advanced lists" <details> element
  const advancedDetails = page.locator("details").filter({ hasText: /Advanced lists and reusable fields/ }).first();
  const isDetailsOpen = await advancedDetails.evaluate((el) => (el as HTMLDetailsElement).open).catch(() => false);
  if (!isDetailsOpen) {
    const detailsSummary = advancedDetails.locator("summary");
    if (await detailsSummary.isVisible({ timeout: 2000 }).catch(() => false)) {
      await detailsSummary.click();
      await page.waitForTimeout(800);
    }
  }
  // Scroll to the FieldLibraryPanel ("Shared Field Library" heading)
  await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll("h3"));
    const libHeading = headings.find((h) => h.textContent?.includes("Shared Field Library"));
    if (libHeading) libHeading.scrollIntoView({ behavior: "instant", block: "center" });
    else window.scrollBy(0, 600);
  });
  await page.waitForTimeout(600);
  await shot(page, "add-library-fields");

  // ── 20–22. Public interview form ────────────────────────────────────────
  console.log("§20-22 public interview");
  const SESSION_TOKEN = process.env.E2E_DOCUFILL_SESSION_TOKEN ?? "";
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
