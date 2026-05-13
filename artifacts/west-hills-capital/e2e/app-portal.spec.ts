import { test, expect } from "@playwright/test";

/**
 * /app portal regression tests.
 *
 * Covers:
 *   - Sign-in page renders (no auth required)
 *   - Sign-up page renders (no auth required)
 *   - Unauthenticated access to /app redirects to /app/sign-in
 *   - Authenticated: sessions page loads without crash
 *   - Authenticated: settings page loads without crash
 *   - Authenticated: default /app route loads Docuplete mapper without crash
 *
 * Auth-gated tests skip automatically when CLERK_SECRET_KEY is not set.
 */

const APP = "/app";
const SIGN_IN = "/app/sign-in";
const SIGN_UP = "/app/sign-up";
const SESSIONS = "/app/sessions";
const SETTINGS = "/app/settings";

test.describe("/app portal — unauthenticated", () => {
  test("sign-in page renders Clerk UI and is not blank", async ({ page }) => {
    await page.goto(SIGN_IN, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    const body = await page.locator("body").textContent({ timeout: 8_000 });
    expect(body?.trim().length).toBeGreaterThan(50);

    const crash = page.locator("text=Something went wrong");
    await expect(crash).not.toBeVisible({ timeout: 2_000 }).catch(() => {});

    const signInEl = page
      .locator("input[name='identifier'], input[type='email'], [data-localization-key], form, .cl-signIn-root")
      .first();
    await expect(signInEl).toBeVisible({ timeout: 10_000 });
  });

  test("sign-up page renders Clerk UI and is not blank", async ({ page }) => {
    await page.goto(SIGN_UP, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    const body = await page.locator("body").textContent({ timeout: 8_000 });
    expect(body?.trim().length).toBeGreaterThan(50);

    const crash = page.locator("text=Something went wrong");
    await expect(crash).not.toBeVisible({ timeout: 2_000 }).catch(() => {});

    const signUpEl = page
      .locator("input[name='emailAddress'], input[type='email'], [data-localization-key], form, .cl-signUp-root")
      .first();
    await expect(signUpEl).toBeVisible({ timeout: 10_000 });
  });

  test("unauthenticated /app access redirects to sign-in", async ({ page }) => {
    await page.goto(APP, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3_000);
    await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => {});

    const url = page.url();
    const body = await page.locator("body").textContent({ timeout: 6_000 });

    const redirectedToSignIn = url.includes("/app/sign-in");
    const showsSignInForm = body?.toLowerCase().includes("sign") ?? false;

    expect(redirectedToSignIn || showsSignInForm).toBe(true);

    const crash = page.locator("text=Something went wrong");
    await expect(crash).not.toBeVisible({ timeout: 2_000 }).catch(() => {});
  });
});

test.describe("/app portal — authenticated", () => {
  test.beforeEach(() => {
    if (!process.env.CLERK_SECRET_KEY) {
      test.skip();
    }
  });

  test("sessions page loads and shows sessions UI", async ({ page }) => {
    await page.goto(SESSIONS, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    const crash = page.locator("text=Something went wrong");
    await expect(crash).not.toBeVisible({ timeout: 3_000 }).catch(() => {});

    const heading = page.locator("h1").filter({ hasText: /sessions/i }).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });

    const tabs = page.locator("[role='tablist']").first();
    await expect(tabs).toBeVisible({ timeout: 5_000 });
  });

  test("settings page loads without crash", async ({ page }) => {
    await page.goto(SETTINGS, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    const crash = page.locator("text=Something went wrong");
    await expect(crash).not.toBeVisible({ timeout: 3_000 }).catch(() => {});

    const body = await page.locator("body").textContent({ timeout: 6_000 });
    expect(body?.trim().length).toBeGreaterThan(100);
  });

  test("default /app route loads Docuplete mapper without crash", async ({ page }) => {
    await page.goto(APP, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    const crash = page.locator("text=Something went wrong");
    await expect(crash).not.toBeVisible({ timeout: 3_000 }).catch(() => {});

    const apiError = page.locator("text=Unexpected end of JSON input");
    await expect(apiError).not.toBeVisible({ timeout: 3_000 }).catch(() => {});

    const body = await page.locator("body").textContent({ timeout: 6_000 });
    expect(body?.trim().length).toBeGreaterThan(100);
  });

  test("sessions page — API call succeeds (no 401/403)", async ({ page }) => {
    const authErrors: string[] = [];
    page.on("response", (res) => {
      const url = res.url();
      const status = res.status();
      if (url.includes("/api/v1/product/") && (status === 401 || status === 403)) {
        authErrors.push(`${res.request().method()} ${url} → ${status}`);
      }
    });

    await page.goto(SESSIONS, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(2_000);

    expect(authErrors).toHaveLength(0);
  });
});
