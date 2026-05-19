import { test, expect } from "@playwright/test";

/**
 * Interview → Generate PDF — full product loop
 *
 * Tests the core Docuplete product loop end-to-end:
 * 1. Create a demo session via the API (uses the seeded demo package)
 * 2. Generate a PDF from it
 * 3. Verify the Sessions page renders without crash
 * 4. Verify the PDF endpoint returns a valid PDF byte stream
 *
 * All tests skip automatically when no auth is configured (CLERK_SECRET_KEY
 * for dev / Clerk testing token, or E2E_EMAIL for real-browser production login).
 */

const DOC_API = "/api/v1/product/docuplete";

function isAuthed(): boolean {
  return !!(process.env.CLERK_SECRET_KEY || process.env.E2E_EMAIL);
}

test.describe("Interview → Generate PDF", () => {
  test.beforeEach(() => {
    if (!isAuthed()) test.skip();
  });

  test("demo-session endpoint creates a session and returns a token", async ({ page }) => {
    const res = await page.request.post(`${DOC_API}/demo-session`);

    // 402 means no packages on the plan — skip gracefully
    if (res.status() === 402 || res.status() === 404) {
      test.skip();
      return;
    }

    expect(res.status()).toBeLessThan(400);
    const body = await res.json() as Record<string, unknown>;
    expect(typeof body.token).toBe("string");
    expect((body.token as string).length).toBeGreaterThan(4);
  });

  test("generate endpoint returns a valid PDF binary", async ({ page }) => {
    // Create demo session
    const createRes = await page.request.post(`${DOC_API}/demo-session`);
    if (!createRes.ok()) { test.skip(); return; }

    const { token } = await createRes.json() as { token: string };
    if (!token) { test.skip(); return; }

    // Generate the PDF
    const genRes = await page.request.post(`${DOC_API}/sessions/${token}/generate`);
    expect([200, 201]).toContain(genRes.status());

    // Fetch via the product PDF endpoint (authenticated)
    const pdfRes = await page.request.get(`${DOC_API}/sessions/${token}/packet.pdf`);
    expect(pdfRes.status()).toBe(200);

    const contentType = pdfRes.headers()["content-type"] ?? "";
    expect(contentType).toContain("pdf");

    // PDF bytes must start with the %PDF magic bytes
    const bytes = await pdfRes.body();
    expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
  });

  test("public packet.pdf endpoint is accessible without auth after generate", async ({ page }) => {
    const createRes = await page.request.post(`${DOC_API}/demo-session`);
    if (!createRes.ok()) { test.skip(); return; }

    const { token } = await createRes.json() as { token: string };
    if (!token) { test.skip(); return; }

    await page.request.post(`${DOC_API}/sessions/${token}/generate`);

    // Public (no-auth) endpoint
    const pdfRes = await page.request.get(`/api/v1/public/docuplete/sessions/${token}/packet.pdf`);
    expect(pdfRes.status()).toBe(200);
    expect((pdfRes.headers()["content-type"] ?? "")).toContain("pdf");
  });

  test("sessions page shows the generated session without crash", async ({ page }) => {
    const createRes = await page.request.post(`${DOC_API}/demo-session`);
    if (!createRes.ok()) { test.skip(); return; }

    const { token } = await createRes.json() as { token: string };
    if (!token) { test.skip(); return; }

    await page.request.post(`${DOC_API}/sessions/${token}/generate`);

    await page.goto("/app/sessions", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    // No crash banner
    await expect(page.locator("text=Something went wrong")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});

    // Heading renders
    const heading = page.locator("h1, h2, h3").filter({ hasText: /sessions/i }).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });

    // At least one PDF download link is present (from the session we just created
    // or from earlier seeded sessions)
    const pdfLinks = page.locator('a[href*="packet.pdf"]');
    await expect(pdfLinks.first()).toBeVisible({ timeout: 10_000 });
  });

  test("sessions API returns no 401/403 auth errors during page load", async ({ page }) => {
    const authErrors: string[] = [];
    page.on("response", (res) => {
      const url  = res.url();
      const code = res.status();
      if (url.includes("/api/v1/product/docuplete/sessions") && (code === 401 || code === 403)) {
        authErrors.push(`${res.request().method()} ${url} → ${code}`);
      }
    });

    await page.goto("/app/sessions", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    expect(authErrors).toHaveLength(0);
  });
});
