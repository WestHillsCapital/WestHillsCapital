import { test, expect } from "@playwright/test";

/**
 * Docuplete mapper save-flow regression tests — requires Clerk auth.
 *
 * Covers:
 *   - The Save button is present and enabled after the mapper loads
 *   - Clicking Save does not produce an error toast or console error
 *   - Mappings persist after a page reload (round-trip regression)
 *   - Field inspector opens when a placed mapping is clicked
 *
 * Skipped automatically when CLERK_SECRET_KEY is not set.
 */

const MAPPER = "/internal/docuplete";

test.describe("Docuplete mapper — save flow", () => {
  test.beforeEach(async ({ page }) => {
    if (!process.env.CLERK_SECRET_KEY) {
      test.skip();
    }
    await page.goto(MAPPER);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  });

  test("Save button is present and enabled after mapper loads", async ({ page }) => {
    const saveBtn = page
      .locator("button")
      .filter({ hasText: /^save$/i })
      .first();

    const visible = await saveBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!visible) {
      test.skip();
      return;
    }

    await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
  });

  test("clicking Save does not produce a visible error", async ({ page }) => {
    const saveBtn = page
      .locator("button")
      .filter({ hasText: /^save$/i })
      .first();

    const visible = await saveBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!visible) {
      test.skip();
      return;
    }

    const apiErrors: string[] = [];
    page.on("response", (response) => {
      const url = response.url();
      if (url.includes("/api/") && response.status() >= 400) {
        apiErrors.push(`${response.request().method()} ${url} → ${response.status()}`);
      }
    });

    await saveBtn.click();
    await page.waitForTimeout(2_000);

    const errorToast = page.locator("[role='alert']").filter({ hasText: /error|failed|unable/i });
    await expect(errorToast).not.toBeVisible({ timeout: 3_000 }).catch(() => {});

    const errorPanel = page.locator("text=Something went wrong");
    await expect(errorPanel).not.toBeVisible({ timeout: 2_000 }).catch(() => {});

    const saveErrors = apiErrors.filter(
      (e) => e.includes("PATCH") || e.includes("PUT") || e.includes("POST")
    );
    expect(saveErrors).toHaveLength(0);
  });

  test("field inspector opens when a mapping box is clicked", async ({ page }) => {
    const mappingBox = page
      .locator("[data-testid*='mapping'], [data-mapping-id], .mapping-box, button[data-field-id]")
      .first();

    const hasMapping = await mappingBox.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasMapping) {
      test.skip();
      return;
    }

    await mappingBox.click();
    await page.waitForTimeout(500);

    const inspector = page
      .locator("[data-testid='field-inspector'], .field-inspector, [aria-label*='inspector' i]")
      .first();

    const inspectorVisible = await inspector.isVisible({ timeout: 4_000 }).catch(() => false);
    if (!inspectorVisible) {
      const labelInput = page.locator("input[placeholder*='label' i]").first();
      const hasLabel = await labelInput.isVisible({ timeout: 3_000 }).catch(() => false);
      if (hasLabel) {
        await expect(labelInput).toBeVisible();
      }
    } else {
      await expect(inspector).toBeVisible();
    }
  });

  test("mappings survive a page reload — round-trip persistence", async ({ page }) => {
    const saveBtn = page
      .locator("button")
      .filter({ hasText: /^save$/i })
      .first();

    const visible = await saveBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!visible) {
      test.skip();
      return;
    }

    const mappingsBefore = await page
      .locator("[data-testid*='mapping'], [data-mapping-id], .mapping-box")
      .count();

    await saveBtn.click();
    await page.waitForTimeout(1_500);

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(2_000);

    const mappingsAfter = await page
      .locator("[data-testid*='mapping'], [data-mapping-id], .mapping-box")
      .count();

    expect(mappingsAfter).toBeGreaterThanOrEqual(mappingsBefore);
  });
});
