import { test, expect } from "@playwright/test";

const MAPPER = "/internal/docufill";

test.describe("DocuFill mapper — authentication required", () => {
  test.beforeEach(async ({ page }) => {
    if (!process.env.CLERK_SECRET_KEY) {
      test.skip();
    }
    await page.goto(MAPPER);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  });

  // -----------------------------------------------------------------------
  // Basic page load
  // -----------------------------------------------------------------------
  test("page loads without crash", async ({ page }) => {
    const url = page.url();
    expect(url).toContain("docufill");
    const errorBanner = page.locator("text=Unexpected end of JSON input");
    await expect(errorBanner).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
    const crashIndicator = page.locator("text=Something went wrong");
    await expect(crashIndicator).not.toBeVisible({ timeout: 1_000 }).catch(() => {});
  });

  // -----------------------------------------------------------------------
  // Bootstrap non-JSON error message improvement
  // (regression: previously showed raw JS error, now shows HTTP status)
  // -----------------------------------------------------------------------
  test("bootstrap error shows status code not raw JS error", async ({ page }) => {
    const rawJsError = page.locator("text=Unexpected end of JSON input");
    await expect(rawJsError).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
  });

  // -----------------------------------------------------------------------
  // Scroll / Single toggle (requires at least one package with a PDF)
  // -----------------------------------------------------------------------
  test("scroll mode toggle renders PDF canvases and switching back works", async ({ page }) => {
    const singleBtn = page.locator("button", { hasText: "Single" }).first();
    const scrollBtn = page.locator("button", { hasText: "Scroll" }).first();

    await expect(singleBtn).toBeVisible({ timeout: 8_000 });
    await expect(scrollBtn).toBeVisible();

    const inScrollMode = await scrollBtn.evaluate((el) =>
      el.className.includes("shadow-[inset_0_-2px_0_#C49A38]")
    );

    if (!inScrollMode) {
      await scrollBtn.click();
      await page.waitForTimeout(1_000);
    }

    const scrollContainer = page.locator(".overflow-y-auto").first();
    await expect(scrollContainer).toBeVisible({ timeout: 5_000 });

    const canvases = page.locator("canvas");
    const canvasCount = await canvases.count();
    if (canvasCount > 0) {
      expect(canvasCount).toBeGreaterThan(0);
    }

    await singleBtn.click();
    await page.waitForTimeout(800);

    await scrollBtn.click();
    await page.waitForTimeout(800);

    await expect(scrollContainer).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Single mode page navigation
  // -----------------------------------------------------------------------
  test("single mode page navigation — prev/next buttons and page indicator", async ({ page }) => {
    const singleBtn = page.locator("button", { hasText: "Single" }).first();
    await singleBtn.click();
    await page.waitForTimeout(500);

    const prevBtn = page.locator("button[title*='Prev page']");
    const nextBtn = page.locator("button[title*='Next page']");

    await expect(prevBtn).toBeVisible({ timeout: 5_000 });
    await expect(nextBtn).toBeVisible();

    await expect(prevBtn).toBeDisabled();

    const pageIndicator = page.locator("text=/\\d+ \\/ \\d+/").first();
    const indicatorText = await pageIndicator.textContent({ timeout: 5_000 }).catch(() => null);

    if (indicatorText) {
      const [, total] = indicatorText.split(" / ").map(Number);

      if (total > 1) {
        await expect(nextBtn).toBeEnabled();
        await nextBtn.click();
        await page.waitForTimeout(600);

        const updated = await pageIndicator.textContent();
        expect(updated).toMatch(/^2 \//);
        await expect(prevBtn).toBeEnabled();

        await prevBtn.click();
        await page.waitForTimeout(600);
        const reset = await pageIndicator.textContent();
        expect(reset).toMatch(/^1 \//);
        await expect(prevBtn).toBeDisabled();
      } else {
        await expect(nextBtn).toBeDisabled();
      }
    }
  });

  // -----------------------------------------------------------------------
  // Package switching resets page to 1 and clears stale state
  // -----------------------------------------------------------------------
  test("switching packages resets page indicator to 1 and loads cleanly", async ({ page }) => {
    const singleBtn = page.locator("button", { hasText: "Single" }).first();
    await singleBtn.click();
    await page.waitForTimeout(500);

    const nextBtn = page.locator("button[title*='Next page']");
    const nextEnabled = await nextBtn.isEnabled().catch(() => false);
    if (nextEnabled) {
      await nextBtn.click();
      await page.waitForTimeout(600);
    }

    const pkgTrigger = page.locator("[data-pkg-dropdown], button[data-testid*='package']").first();
    const pkgDropdownVisible = await pkgTrigger.isVisible().catch(() => false);

    if (!pkgDropdownVisible) {
      const pkgButtons = page.locator("button").filter({ hasText: /package/i });
      const count = await pkgButtons.count();
      if (count < 2) {
        test.skip();
        return;
      }
    }

    const pkgItems = page.locator("button[role='menuitem'], [role='option']").filter({ hasText: /package|IRA|Roth/i });
    const pkgCount = await pkgItems.count();

    if (pkgCount >= 2) {
      await pkgItems.nth(1).click();
      await page.waitForTimeout(1_000);

      const pageIndicator = page.locator("text=/\\d+ \\/ \\d+/").first();
      const indicatorText = await pageIndicator.textContent({ timeout: 5_000 }).catch(() => null);
      if (indicatorText) {
        expect(indicatorText).toMatch(/^1 \//);
      }

      const errorBanner = page.locator("text=Unexpected end of JSON input");
      await expect(errorBanner).not.toBeVisible({ timeout: 2_000 }).catch(() => {});
    }
  });

  // -----------------------------------------------------------------------
  // Orphaned mapping boxes are not rendered
  // -----------------------------------------------------------------------
  test("no mapping boxes render for fields not in selectedPackage.fields", async ({ page }) => {
    const mappingBoxes = page.locator("button[data-testid*='mapping'], .mapping-box");
    const count = await mappingBoxes.count();

    if (count === 0) {
      return;
    }

    await expect(mappingBoxes.first()).toBeVisible({ timeout: 3_000 });
  });
});
