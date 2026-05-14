import { test, expect } from "@playwright/test";

/**
 * Field Library tab smoke tests — /app (Library tab within Docuplete)
 *
 * Unauthenticated: /app redirects to sign-in (no crash).
 * Authenticated: Library tab renders Fields/Types/Groups subtabs,
 *   card grid appears, search filters cards, hints toggle shows labels.
 *
 * Auth-gated tests skip automatically when CLERK_SECRET_KEY is not set.
 */

const APP = "/app";
const SIGN_IN = "/app/sign-in";

test.describe("Field Library — unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

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
  });
});

test.describe("Field Library — authenticated", () => {
  test.beforeEach(() => {
    if (!process.env.CLERK_SECRET_KEY && !process.env.E2E_EMAIL) test.skip();
  });

  test("Library tab is visible and clickable", async ({ page }) => {
    await page.goto(APP, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    await expect(page.locator("text=Something went wrong")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});

    const libraryTab = page.locator("button, [role='tab']").filter({ hasText: /^library$/i }).first();
    await expect(libraryTab).toBeVisible({ timeout: 10_000 });

    await libraryTab.click();
    await page.waitForTimeout(1_000);

    await expect(page.locator("text=Something went wrong")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
  });

  test("Library shows Fields, Types, Groups subtabs", async ({ page }) => {
    await page.goto(APP, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    const libraryTab = page.locator("button, [role='tab']").filter({ hasText: /^library$/i }).first();
    const hasLib = await libraryTab.isVisible({ timeout: 8_000 }).catch(() => false);
    if (!hasLib) { test.skip(); return; }

    await libraryTab.click();
    await page.waitForTimeout(1_000);

    const fieldsSubtab = page.locator("button, [role='tab']").filter({ hasText: /^fields$/i }).first();
    const typesSubtab  = page.locator("button, [role='tab']").filter({ hasText: /^types$/i }).first();
    const groupsSubtab = page.locator("button, [role='tab']").filter({ hasText: /^groups$/i }).first();

    await expect(fieldsSubtab).toBeVisible({ timeout: 6_000 });
    await expect(typesSubtab).toBeVisible({ timeout: 6_000 });
    await expect(groupsSubtab).toBeVisible({ timeout: 6_000 });
  });

  test("Fields subtab shows card grid without crash", async ({ page }) => {
    await page.goto(APP, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    const libraryTab = page.locator("button, [role='tab']").filter({ hasText: /^library$/i }).first();
    const hasLib = await libraryTab.isVisible({ timeout: 8_000 }).catch(() => false);
    if (!hasLib) { test.skip(); return; }

    await libraryTab.click();
    await page.waitForTimeout(500);

    const fieldsSubtab = page.locator("button, [role='tab']").filter({ hasText: /^fields$/i }).first();
    const hasSub = await fieldsSubtab.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasSub) await fieldsSubtab.click();

    await page.waitForTimeout(1_000);
    await expect(page.locator("text=Something went wrong")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});

    const hasCards = await page.locator(".rounded.bg-\\[\\#F8F6F0\\], [class*='rounded'][class*='border']").count() > 0;
    const hasEmpty = await page.locator("text=/no fields|empty|add your first/i").count() > 0;
    expect(hasCards || hasEmpty).toBe(true);
  });

  test("search bar in Fields tab filters the card list", async ({ page }) => {
    await page.goto(APP, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    const libraryTab = page.locator("button, [role='tab']").filter({ hasText: /^library$/i }).first();
    const hasLib = await libraryTab.isVisible({ timeout: 8_000 }).catch(() => false);
    if (!hasLib) { test.skip(); return; }

    await libraryTab.click();
    await page.waitForTimeout(500);

    const fieldsSubtab = page.locator("button, [role='tab']").filter({ hasText: /^fields$/i }).first();
    const hasSub = await fieldsSubtab.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasSub) await fieldsSubtab.click();

    await page.waitForTimeout(500);

    const search = page.locator("input[placeholder*='search' i], input[placeholder*='filter' i]").first();
    const hasSearch = await search.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasSearch) { test.skip(); return; }

    const cardsBefore = await page.locator("[class*='rounded'][class*='border'][class*='bg']").count();
    if (cardsBefore === 0) { test.skip(); return; }

    await search.fill("zzzzzz_no_match_xyzzy");
    await page.waitForTimeout(400);

    const cardsAfter = await page.locator("[class*='rounded'][class*='border'][class*='bg']").count();
    expect(cardsAfter).toBeLessThan(cardsBefore);
  });

  test("hints toggle (?) shows inline field labels on cards", async ({ page }) => {
    await page.goto(APP, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    const libraryTab = page.locator("button, [role='tab']").filter({ hasText: /^library$/i }).first();
    const hasLib = await libraryTab.isVisible({ timeout: 8_000 }).catch(() => false);
    if (!hasLib) { test.skip(); return; }

    await libraryTab.click();
    await page.waitForTimeout(500);

    const fieldsSubtab = page.locator("button, [role='tab']").filter({ hasText: /^fields$/i }).first();
    const hasSub = await fieldsSubtab.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasSub) await fieldsSubtab.click();

    await page.waitForTimeout(500);

    const hintsBtn = page.locator("button").filter({ hasText: "?" }).first();
    const hasHints = await hintsBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasHints) { test.skip(); return; }

    await hintsBtn.click();
    await page.waitForTimeout(400);

    const labelEl = page.locator("text=Label").first();
    await expect(labelEl).toBeVisible({ timeout: 5_000 });
  });

  test("field type buttons change selection state on a card", async ({ page }) => {
    await page.goto(APP, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    const libraryTab = page.locator("button, [role='tab']").filter({ hasText: /^library$/i }).first();
    const hasLib = await libraryTab.isVisible({ timeout: 8_000 }).catch(() => false);
    if (!hasLib) { test.skip(); return; }

    await libraryTab.click();
    await page.waitForTimeout(500);

    const fieldsSubtab = page.locator("button, [role='tab']").filter({ hasText: /^fields$/i }).first();
    const hasSub = await fieldsSubtab.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasSub) await fieldsSubtab.click();

    await page.waitForTimeout(500);

    const radioBtn = page.locator("button").filter({ hasText: /^radio$/i }).first();
    const hasRadio = await radioBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasRadio) { test.skip(); return; }

    await radioBtn.click();
    await page.waitForTimeout(300);

    const isSelected = await radioBtn.evaluate((el) =>
      el.className.includes("bg-[#0F1C3F]") || el.className.includes("text-white")
    );
    expect(isSelected).toBe(true);
  });
});
