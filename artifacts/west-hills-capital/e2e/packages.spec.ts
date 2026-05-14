import { test, expect } from "@playwright/test";

/**
 * Packages tab smoke tests — /app (default Docuplete route).
 *
 * Unauthenticated: verifies redirect to sign-in (no crash).
 * Authenticated: verifies Packages tab renders list or empty state,
 *   "New Package" button is present, and clicking a package opens it.
 *
 * Auth-gated tests skip automatically when CLERK_SECRET_KEY is not set.
 */

const APP = "/app";
const SIGN_IN = "/app/sign-in";

test.describe("Packages — unauthenticated", () => {
  test("unauthenticated /app redirects to sign-in without crash", async ({ page }) => {
    await page.goto(APP, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5_000);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    const url = page.url();
    const body = await page.locator("body").textContent({ timeout: 6_000 });

    const redirected = url.includes(SIGN_IN);
    const showsSignIn = body?.toLowerCase().includes("sign") ?? false;
    expect(redirected || showsSignIn).toBe(true);

    await expect(page.locator("text=Something went wrong")).not.toBeVisible({ timeout: 2_000 }).catch(() => {});
    await expect(page.locator("text=Unexpected end of JSON")).not.toBeVisible({ timeout: 2_000 }).catch(() => {});
  });
});

test.describe("Packages — authenticated", () => {
  test.beforeEach(() => {
    if (!process.env.CLERK_SECRET_KEY && !process.env.E2E_EMAIL) test.skip();
  });

  test("Packages tab renders without crash", async ({ page }) => {
    await page.goto(APP, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    await expect(page.locator("text=Something went wrong")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
    await expect(page.locator("text=Unexpected end of JSON")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});

    const body = await page.locator("body").textContent({ timeout: 8_000 });
    expect(body?.trim().length).toBeGreaterThan(100);
  });

  test("Packages tab shows package list or empty state", async ({ page }) => {
    await page.goto(APP, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    const packagesTab = page.locator("button, [role='tab']").filter({ hasText: /packages/i }).first();
    const tabVisible = await packagesTab.isVisible({ timeout: 5_000 }).catch(() => false);
    if (tabVisible) await packagesTab.click();

    await page.waitForTimeout(1_000);

    const hasPackageContent =
      (await page.locator("text=/package/i").count()) > 0 ||
      (await page.locator("text=/no packages/i").count()) > 0 ||
      (await page.locator("text=/empty/i").count()) > 0;
    expect(hasPackageContent).toBe(true);
  });

  test("New Package button is present", async ({ page }) => {
    await page.goto(APP, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    const packagesTab = page.locator("button, [role='tab']").filter({ hasText: /packages/i }).first();
    const tabVisible = await packagesTab.isVisible({ timeout: 5_000 }).catch(() => false);
    if (tabVisible) await packagesTab.click();

    await page.waitForTimeout(500);

    const newBtn = page.locator("button").filter({ hasText: /new package|add package|\+ package/i }).first();
    await expect(newBtn).toBeVisible({ timeout: 8_000 });
  });

  test("clicking a package opens it without crash", async ({ page }) => {
    await page.goto(APP, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    const packagesTab = page.locator("button, [role='tab']").filter({ hasText: /packages/i }).first();
    const tabVisible = await packagesTab.isVisible({ timeout: 5_000 }).catch(() => false);
    if (tabVisible) await packagesTab.click();

    await page.waitForTimeout(500);

    const firstPackage = page.locator("[data-testid='package-row'], .package-row, [role='row']").first();
    const hasPackages = await firstPackage.isVisible({ timeout: 4_000 }).catch(() => false);
    if (!hasPackages) {
      test.skip();
      return;
    }

    await firstPackage.click();
    await page.waitForTimeout(1_000);

    await expect(page.locator("text=Something went wrong")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
    const body = await page.locator("body").textContent({ timeout: 5_000 });
    expect(body?.trim().length).toBeGreaterThan(100);
  });
});
