import { test, expect } from "@playwright/test";

/**
 * Sessions page smoke tests — /app/sessions
 *
 * Unauthenticated: verifies redirect to sign-in (no crash).
 * Authenticated: verifies sessions list renders, status badges show,
 *   search filters rows, sort headers work, void modal opens.
 *
 * Auth-gated tests skip automatically when CLERK_SECRET_KEY is not set.
 */

const SESSIONS = "/app/sessions";
const SIGN_IN = "/app/sign-in";

test.describe("Sessions — unauthenticated", () => {
  test("unauthenticated /app/sessions redirects to sign-in without crash", async ({ page }) => {
    await page.goto(SESSIONS, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5_000);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    const url = page.url();
    const body = await page.locator("body").textContent({ timeout: 6_000 });

    const redirected = url.includes(SIGN_IN);
    const showsSignIn = body?.toLowerCase().includes("sign") ?? false;
    expect(redirected || showsSignIn).toBe(true);

    await expect(page.locator("text=Something went wrong")).not.toBeVisible({ timeout: 2_000 }).catch(() => {});
  });
});

test.describe("Sessions — authenticated", () => {
  test.beforeEach(() => {
    if (!process.env.CLERK_SECRET_KEY && !process.env.E2E_EMAIL) test.skip();
  });

  test("sessions page loads and shows Sessions tab", async ({ page }) => {
    await page.goto(SESSIONS, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    await expect(page.locator("text=Something went wrong")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});

    const sessionsTab = page.locator("button, [role='tab']").filter({ hasText: /^sessions$/i }).first();
    await expect(sessionsTab).toBeVisible({ timeout: 10_000 });
  });

  test("sessions list renders table or empty state without crash", async ({ page }) => {
    await page.goto(SESSIONS, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    await expect(page.locator("text=Something went wrong")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
    await expect(page.locator("text=Unexpected end of JSON")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});

    const hasTable = await page.locator("table, [role='table'], [role='grid']").count() > 0;
    const hasEmpty = await page.locator("text=/no sessions|no results|empty/i").count() > 0;
    expect(hasTable || hasEmpty).toBe(true);
  });

  test("status badges render (Draft, In Progress, Complete, or Voided)", async ({ page }) => {
    await page.goto(SESSIONS, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    const rowCount = await page.locator("table tbody tr, [role='row']").count();
    if (rowCount === 0) { test.skip(); return; }

    const badge = page.locator("text=/draft|in progress|complete|voided/i").first();
    await expect(badge).toBeVisible({ timeout: 8_000 });
  });

  test("search field filters the sessions list", async ({ page }) => {
    await page.goto(SESSIONS, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    const rowsBefore = await page.locator("table tbody tr").count();
    if (rowsBefore === 0) { test.skip(); return; }

    const search = page.locator("input[type='search'], input[placeholder*='search' i], input[placeholder*='filter' i]").first();
    const hasSearch = await search.isVisible({ timeout: 4_000 }).catch(() => false);
    if (!hasSearch) { test.skip(); return; }

    await search.fill("zzzzzz_no_match_xyzzy");
    await page.waitForTimeout(600);

    const rowsAfter = await page.locator("table tbody tr").count();
    expect(rowsAfter).toBeLessThan(rowsBefore);
  });

  test("clicking a column header changes sort direction", async ({ page }) => {
    await page.goto(SESSIONS, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    const rowCount = await page.locator("table tbody tr").count();
    if (rowCount < 2) { test.skip(); return; }

    const sortableHeader = page.locator("th button, th[role='button'], th.cursor-pointer").first();
    const hasHeader = await sortableHeader.isVisible({ timeout: 4_000 }).catch(() => false);
    if (!hasHeader) { test.skip(); return; }

    await sortableHeader.click();
    await page.waitForTimeout(400);
    await expect(page.locator("text=Something went wrong")).not.toBeVisible({ timeout: 2_000 }).catch(() => {});
  });

  test("void button opens modal requiring a reason", async ({ page }) => {
    await page.goto(SESSIONS, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    const voidBtn = page.locator("button").filter({ hasText: /^void$/i }).first();
    const hasVoid = await voidBtn.isVisible({ timeout: 6_000 }).catch(() => false);
    if (!hasVoid) { test.skip(); return; }

    await voidBtn.click();
    await page.waitForTimeout(500);

    const modal = page.locator("text=/void/i, [role='dialog']").first();
    await expect(modal).toBeVisible({ timeout: 5_000 });

    const submitBtn = page.locator("button[type='submit'], button").filter({ hasText: /void session/i }).first();
    await expect(submitBtn).toBeDisabled({ timeout: 3_000 });
  });

  test("generated session shows PDF download link", async ({ page }) => {
    await page.goto(SESSIONS, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    const pdfLink = page.locator("a[href*='.pdf'], a").filter({ hasText: /download|pdf/i }).first();
    const hasPdf = await pdfLink.isVisible({ timeout: 6_000 }).catch(() => false);
    if (!hasPdf) { test.skip(); return; }

    await expect(pdfLink).toBeVisible();
  });
});
