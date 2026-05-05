/**
 * Docuplete — Minimal smoke test
 * Checkly Browser Check — paste into the Checkly script editor.
 *
 * Runtime: 2025.04 (select in check settings)
 * Format: Playwright Test (import syntax) — required for 2024.02+ runtimes
 */

import { test, expect } from "@playwright/test";

test("homepage loads", async ({ page }) => {
  console.log("starting test");
  await page.goto("https://www.westhillscapital.com", { timeout: 30_000 });
  console.log("page url:", page.url());
  const title = await page.title();
  console.log("page title:", title);
  expect(title.length).toBeGreaterThan(0);
  console.log("✅ done");
});
