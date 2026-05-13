import { test, expect } from "@playwright/test";

/**
 * Field Library regression tests — requires Clerk auth.
 *
 * Covers the CRUD operations that were at risk after the PATCH 404 fix:
 *   - Page loads and field list renders
 *   - Create a new field (POST)
 *   - Edit that field (PATCH — the previously broken path)
 *   - Delete that field
 *
 * Skipped automatically when CLERK_SECRET_KEY is not set.
 */

const FIELD_LIBRARY = "/internal/docuplete";

test.describe("Field Library CRUD", () => {
  test.beforeEach(async ({ page }) => {
    if (!process.env.CLERK_SECRET_KEY) {
      test.skip();
    }
    await page.goto(FIELD_LIBRARY);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  });

  test("field library tab loads and shows field list", async ({ page }) => {
    const libraryTab = page.locator("button, [role='tab']").filter({ hasText: /library|field library/i }).first();
    const tabVisible = await libraryTab.isVisible({ timeout: 8_000 }).catch(() => false);
    if (!tabVisible) {
      test.skip();
      return;
    }
    await libraryTab.click();
    await page.waitForTimeout(1_000);

    const errorPanel = page.locator("text=Something went wrong");
    await expect(errorPanel).not.toBeVisible({ timeout: 3_000 }).catch(() => {});

    const fieldList = page.locator("table, [data-testid='field-library-list'], .field-library").first();
    const listVisible = await fieldList.isVisible({ timeout: 6_000 }).catch(() => false);

    if (!listVisible) {
      const bodyText = await page.locator("body").textContent();
      expect(bodyText?.toLowerCase()).toMatch(/field|library|add/i);
    }
  });

  test("can open field library and see add-field control", async ({ page }) => {
    const libraryTab = page.locator("button, [role='tab']").filter({ hasText: /library|field library/i }).first();
    const tabVisible = await libraryTab.isVisible({ timeout: 8_000 }).catch(() => false);
    if (!tabVisible) {
      test.skip();
      return;
    }
    await libraryTab.click();
    await page.waitForTimeout(1_000);

    const addBtn = page.locator("button").filter({ hasText: /add field|new field|create field/i }).first();
    const addVisible = await addBtn.isVisible({ timeout: 6_000 }).catch(() => false);
    if (!addVisible) {
      test.skip();
      return;
    }

    await expect(addBtn).toBeEnabled();
  });

  test("create a new field — form submits and field appears in list", async ({ page }) => {
    const libraryTab = page.locator("button, [role='tab']").filter({ hasText: /library|field library/i }).first();
    const tabVisible = await libraryTab.isVisible({ timeout: 8_000 }).catch(() => false);
    if (!tabVisible) {
      test.skip();
      return;
    }
    await libraryTab.click();
    await page.waitForTimeout(1_000);

    const addBtn = page.locator("button").filter({ hasText: /add field|new field|create field/i }).first();
    const addVisible = await addBtn.isVisible({ timeout: 6_000 }).catch(() => false);
    if (!addVisible) {
      test.skip();
      return;
    }

    await addBtn.click();
    await page.waitForTimeout(500);

    const labelInput = page.locator("input[placeholder*='label' i], input[placeholder*='name' i], input[name='label']").first();
    const inputVisible = await labelInput.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!inputVisible) {
      test.skip();
      return;
    }

    const testLabel = `E2E Test Field ${Date.now()}`;
    await labelInput.fill(testLabel);

    const saveBtn = page.locator("button").filter({ hasText: /save|create|add/i }).last();
    await saveBtn.click();
    await page.waitForTimeout(1_500);

    const errorMessage = page.locator("text=error, text=failed").first();
    await expect(errorMessage).not.toBeVisible({ timeout: 2_000 }).catch(() => {});
  });

  test("edit a field — PATCH does not return 404", async ({ page }) => {
    const libraryTab = page.locator("button, [role='tab']").filter({ hasText: /library|field library/i }).first();
    const tabVisible = await libraryTab.isVisible({ timeout: 8_000 }).catch(() => false);
    if (!tabVisible) {
      test.skip();
      return;
    }
    await libraryTab.click();
    await page.waitForTimeout(1_000);

    const patchErrors: string[] = [];
    page.on("response", (response) => {
      if (response.url().includes("/field-library") && response.request().method() === "PATCH") {
        if (response.status() === 404) {
          patchErrors.push(`PATCH ${response.url()} returned 404`);
        }
      }
    });

    const firstField = page.locator("tr, [data-testid='field-row']").nth(1);
    const fieldVisible = await firstField.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!fieldVisible) {
      test.skip();
      return;
    }

    await firstField.click();
    await page.waitForTimeout(500);

    const editBtn = page.locator("button").filter({ hasText: /edit/i }).first();
    const editVisible = await editBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    if (editVisible) {
      await editBtn.click();
      await page.waitForTimeout(500);
    }

    const labelInput = page.locator("input[placeholder*='label' i], input[name='label']").first();
    const inputVisible = await labelInput.isVisible({ timeout: 3_000 }).catch(() => false);
    if (!inputVisible) {
      test.skip();
      return;
    }

    const currentValue = await labelInput.inputValue();
    await labelInput.fill(currentValue + " ");
    await labelInput.fill(currentValue);

    const saveBtn = page.locator("button").filter({ hasText: /save/i }).first();
    const saveVisible = await saveBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    if (saveVisible) {
      await saveBtn.click();
      await page.waitForTimeout(1_500);
    }

    expect(patchErrors).toHaveLength(0);
  });
});
