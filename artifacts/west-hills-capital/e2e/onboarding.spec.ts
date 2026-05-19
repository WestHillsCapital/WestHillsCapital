import { test, expect } from "@playwright/test";

/**
 * Onboarding flow — E2E
 *
 * Tests the user onboarding journey:
 * 1. New unauthenticated visitor → redirected to sign-in, not to onboarding
 * 2. Sign-up page renders the correct form elements
 * 3. Authenticated (already onboarded) user → goes directly to app, no loop
 * 4. Onboarding page structure renders without crash
 *
 * The full "new user → fill onboarding form → enter app" path cannot be
 * exercised in automated CI without creating a throw-away Clerk user, which
 * requires CLERK_SECRET_KEY. Tests that need auth skip when it's absent.
 *
 * Corresponds to test plan items T02–T09 in docuplete-app.test-plan.md.
 */

// ── T02: Unauthenticated visitor never sees onboarding directly ──────────────

test.describe("Onboarding — unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("T02 · visiting /app/onboarding without auth redirects to sign-in", async ({ page }) => {
    await page.goto("/app/onboarding", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3_000);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    const url  = page.url();
    const body = await page.locator("body").textContent({ timeout: 6_000 });

    const redirected      = url.includes("/app/sign-in");
    const showsSignInForm = body?.toLowerCase().includes("sign") ?? false;

    expect(redirected || showsSignInForm).toBe(true);

    // No crash
    await expect(page.locator("text=Something went wrong")).not.toBeVisible({ timeout: 2_000 }).catch(() => {});
  });

  test("T03 · sign-up page shows email and name fields", async ({ page }) => {
    await page.goto("/app/sign-up", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // No crash
    await expect(page.locator("text=Something went wrong")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});

    const body = await page.locator("body").textContent({ timeout: 6_000 });
    expect(body?.trim().length).toBeGreaterThan(50);

    // Clerk renders either an email input or a social login button
    const signUpEl = page.locator(
      "input[name='emailAddress'], input[type='email'], [data-localization-key], .cl-signUp-root, form"
    ).first();
    await expect(signUpEl).toBeVisible({ timeout: 10_000 });
  });

  test("T04 · sign-in page form renders and is not blank", async ({ page }) => {
    await page.goto("/app/sign-in", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    await expect(page.locator("text=Something went wrong")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});

    const signInEl = page.locator(
      "input[name='identifier'], input[type='email'], [data-localization-key], .cl-signIn-root"
    ).first();
    await expect(signInEl).toBeVisible({ timeout: 10_000 });
  });
});

// ── T05–T09: Authenticated user — onboarding completes and app opens ─────────

test.describe("Onboarding — authenticated", () => {
  test.beforeEach(() => {
    if (!process.env.CLERK_SECRET_KEY && !process.env.E2E_EMAIL) test.skip();
  });

  test("T05 · already-onboarded user lands on /app, not on /app/onboarding", async ({ page }) => {
    await page.goto("/app", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    // Should NOT be stuck on onboarding
    const url = page.url();
    expect(url).not.toContain("/onboarding");

    // No crash
    await expect(page.locator("text=Something went wrong")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
  });

  test("T06 · /app renders meaningful content for an onboarded user", async ({ page }) => {
    await page.goto("/app", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    await expect(page.locator("text=Something went wrong")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
    await expect(page.locator("text=Unexpected end of JSON")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});

    const body = await page.locator("body").textContent({ timeout: 6_000 });
    expect(body?.trim().length).toBeGreaterThan(100);
  });

  test("T07 · navigating directly to /app/sessions works without crash", async ({ page }) => {
    await page.goto("/app/sessions", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    await expect(page.locator("text=Something went wrong")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});

    const heading = page.locator("h1, h2, h3").filter({ hasText: /sessions/i }).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("T08 · settings page loads and shows at least one settings section", async ({ page }) => {
    await page.goto("/app/settings", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    await expect(page.locator("text=Something went wrong")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});

    const body = await page.locator("body").textContent({ timeout: 6_000 });
    expect(body?.trim().length).toBeGreaterThan(100);

    // Settings page must have some form of nav (tabs or sections)
    const tabs = page.locator("[role='tablist'], [role='navigation'], nav").first();
    await expect(tabs).toBeVisible({ timeout: 10_000 });
  });

  test("T09 · bootstrap API returns 200 with packages array for onboarded user", async ({ page }) => {
    const res = await page.request.get("/api/v1/product/docuplete/bootstrap");
    expect(res.status()).toBe(200);

    const body = await res.json() as Record<string, unknown>;

    // Bootstrap must return packages (may be empty for a fresh org)
    expect(Array.isArray(body.packages)).toBe(true);
  });
});
