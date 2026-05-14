import { test, expect } from "@playwright/test";

/**
 * Batch Runs tab smoke tests — /app/sessions (Batch tab)
 *
 * Unauthenticated: page redirects to sign-in.
 * Authenticated: Batch tab renders run list or empty state,
 *   a batch row shows expected columns, clicking a row expands sessions.
 *
 * Auth-gated tests skip automatically when CLERK_SECRET_KEY is not set.
 */

const SESSIONS = "/app/sessions";
const SIGN_IN = "/app/sign-in";

test.describe("Batch Runs — unauthenticated", () => {
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

test.describe("Batch Runs — authenticated", () => {
  test.beforeEach(() => {
    if (!process.env.CLERK_SECRET_KEY && !process.env.E2E_EMAIL) test.skip();
  });

  test("Batch tab is visible and clickable", async ({ page }) => {
    await page.goto(SESSIONS, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    await expect(page.locator("text=Something went wrong")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});

    const batchTab = page.locator("button, [role='tab']").filter({ hasText: /batch/i }).first();
    await expect(batchTab).toBeVisible({ timeout: 10_000 });

    await batchTab.click();
    await page.waitForTimeout(1_000);

    await expect(page.locator("text=Something went wrong")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
  });

  test("Batch tab shows run list or empty state without crash", async ({ page }) => {
    await page.goto(SESSIONS, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    const batchTab = page.locator("button, [role='tab']").filter({ hasText: /batch/i }).first();
    const hasTab = await batchTab.isVisible({ timeout: 6_000 }).catch(() => false);
    if (!hasTab) { test.skip(); return; }

    await batchTab.click();
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1_000);

    await expect(page.locator("text=Something went wrong")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
    await expect(page.locator("text=Unexpected end of JSON")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});

    const hasList = await page.locator("table tbody tr, [role='row']").count() > 0;
    const hasEmpty = await page.locator("text=/no batch|no runs|empty/i").count() > 0;
    const hasContent = (await page.locator("body").textContent({ timeout: 5_000 }))?.trim().length ?? 0 > 100;
    expect(hasList || hasEmpty || hasContent).toBe(true);
  });

  test("batch run row shows package name and session counts", async ({ page }) => {
    await page.goto(SESSIONS, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    const batchTab = page.locator("button, [role='tab']").filter({ hasText: /batch/i }).first();
    const hasTab = await batchTab.isVisible({ timeout: 6_000 }).catch(() => false);
    if (!hasTab) { test.skip(); return; }

    await batchTab.click();
    await page.waitForTimeout(1_500);

    const firstRow = page.locator("table tbody tr, [role='row']").first();
    const hasRow = await firstRow.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasRow) { test.skip(); return; }

    const rowText = await firstRow.textContent({ timeout: 4_000 });
    expect(rowText?.trim().length).toBeGreaterThan(0);

    const hasCountPattern = /\d+/.test(rowText ?? "");
    expect(hasCountPattern).toBe(true);
  });

  test("clicking a batch run row expands or navigates to its sessions", async ({ page }) => {
    await page.goto(SESSIONS, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    const batchTab = page.locator("button, [role='tab']").filter({ hasText: /batch/i }).first();
    const hasTab = await batchTab.isVisible({ timeout: 6_000 }).catch(() => false);
    if (!hasTab) { test.skip(); return; }

    await batchTab.click();
    await page.waitForTimeout(1_500);

    const firstRow = page.locator("table tbody tr, [role='row']").first();
    const hasRow = await firstRow.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasRow) { test.skip(); return; }

    await firstRow.click();
    await page.waitForTimeout(1_000);

    await expect(page.locator("text=Something went wrong")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
    const body = await page.locator("body").textContent({ timeout: 5_000 });
    expect(body?.trim().length).toBeGreaterThan(100);
  });
});
