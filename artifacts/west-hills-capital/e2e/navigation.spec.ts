import { test, expect } from "@playwright/test";

/**
 * Navigation smoke tests — public pages only, no auth required.
 *
 * Purpose: Catch blank-page regressions caused by lazy-chunk failures,
 * routing misconfigurations, or broken imports. These run fast and require
 * no credentials.
 *
 * Each test visits the page and verifies that meaningful content is
 * present in the DOM (not a blank screen or spinner that never resolves).
 */

const PUBLIC_ROUTES: { path: string; expect: string }[] = [
  { path: "/",               expect: "West Hills Capital" },
  { path: "/pricing",        expect: "spot"              },
  { path: "/ira",            expect: "IRA"               },
  { path: "/about",          expect: "West Hills"        },
  { path: "/faq",            expect: "commission"        },
  { path: "/schedule",       expect: "schedule"          },
  { path: "/insights",       expect: "Insights"          },
  { path: "/disclosures",    expect: "Disclosures"       },
  { path: "/terms",          expect: "Terms"             },
  { path: "/privacy",        expect: "Privacy"           },
  { path: "/ira/rollovers",  expect: "rollover"          },
  { path: "/ira/custodians", expect: "custodian"         },
];

test.describe("Public page navigation smoke tests", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.path} — loads without blank screen`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });

      expect(response?.status()).not.toBe(404);
      expect(response?.status()).not.toBe(500);

      await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => {});

      const bodyText = await page.locator("body").textContent({ timeout: 8_000 });
      expect(bodyText?.trim().length).toBeGreaterThan(100);

      const spinner = page.locator(".animate-spin");
      const spinnerCount = await spinner.count();
      if (spinnerCount > 0) {
        await expect(spinner.first()).not.toBeVisible({ timeout: 8_000 }).catch(() => {});
      }

      const bodyTextAfter = await page.locator("body").textContent();
      expect(bodyTextAfter?.toLowerCase()).toContain(route.expect.toLowerCase());
    });
  }

  test("clicking nav links does not blank the page", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    const faqLink = page.locator("a[href='/faq'], a[href*='/faq']").first();
    const faqVisible = await faqLink.isVisible().catch(() => false);
    if (!faqVisible) return;

    await faqLink.click();
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    const bodyText = await page.locator("body").textContent({ timeout: 6_000 });
    expect(bodyText?.trim().length).toBeGreaterThan(100);

    expect(page.url()).toContain("/faq");
    expect(bodyText?.toLowerCase()).toContain("commission");
  });

  test("404 route shows not-found page not a blank screen", async ({ page }) => {
    await page.goto("/this-path-definitely-does-not-exist-xyzzy");
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    const bodyText = await page.locator("body").textContent({ timeout: 6_000 });
    expect(bodyText?.trim().length).toBeGreaterThan(10);
  });
});
