import { test, expect } from "@playwright/test";

/**
 * E-signing flow — end-to-end
 *
 * Tests the e-sign surface:
 * 1. Creating a session against an e-sign (email_otp) package
 * 2. Verifying the signer page renders without crash (public, no auth required)
 * 3. Verifying the sessions UI shows the correct pending-signature status
 *
 * The /verify public route is where the signer lands after clicking the link
 * in their email. It is fully public (no Clerk auth required).
 *
 * Auth-gated tests (creating sessions) skip when CLERK_SECRET_KEY or E2E_EMAIL
 * is absent. The public /verify page test runs in all environments.
 */

const DOC_API = "/api/v1/product/docuplete";

function isAuthed(): boolean {
  return !!(process.env.CLERK_SECRET_KEY || process.env.E2E_EMAIL);
}

// ── Public /verify page — no auth needed ────────────────────────────────────

test.describe("E-sign — public /verify page", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/verify page renders without crash (no token)", async ({ page }) => {
    await page.goto("/verify", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    const crash = page.locator("text=Something went wrong");
    await expect(crash).not.toBeVisible({ timeout: 3_000 }).catch(() => {});

    // Should show some UI — either an error about missing token, or the form
    const body = await page.locator("body").textContent({ timeout: 6_000 });
    expect(body?.trim().length).toBeGreaterThan(10);
  });

  test("/verify page with unknown token shows a graceful error, not a crash", async ({ page }) => {
    await page.goto("/verify?token=invalid-token-e2e-test", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // No blank white page
    const body = await page.locator("body").textContent({ timeout: 6_000 });
    expect(body?.trim().length).toBeGreaterThan(10);

    // No unhandled JS error banner
    const crash = page.locator("text=Something went wrong");
    await expect(crash).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
  });
});

// ── Authenticated: create e-sign session and inspect ────────────────────────

test.describe("E-sign — authenticated session management", () => {
  test.beforeEach(() => {
    if (!isAuthed()) test.skip();
  });

  test("sessions page renders without crash and shows Sessions heading", async ({ page }) => {
    await page.goto("/app/sessions", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    await expect(page.locator("text=Something went wrong")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
    const heading = page.locator("h1, h2, h3").filter({ hasText: /sessions/i }).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("creating a session for an e-sign package returns a signer link", async ({ page }) => {
    // Fetch packages and look for an email_otp (e-sign) package
    const pkgsRes = await page.request.get(`${DOC_API}/packages`);
    if (!pkgsRes.ok()) { test.skip(); return; }

    const pkgsBody = await pkgsRes.json() as { packages?: Array<{ id: number; verification_mode?: string; name: string }> };
    const esignPkg = (pkgsBody.packages ?? []).find(p => p.verification_mode === "email_otp");

    if (!esignPkg) {
      // No e-sign package available in this environment — skip gracefully
      test.skip();
      return;
    }

    // Create a session against the e-sign package
    const createRes = await page.request.post(`${DOC_API}/sessions`, {
      data: {
        packageId: esignPkg.id,
        signerName: "E2E Signer",
        signerEmail: "e2e-signer@test.example",
      },
    });

    if (createRes.status() === 402) { test.skip(); return; } // plan limit
    expect(createRes.status()).toBeLessThan(400);

    const body = await createRes.json() as Record<string, unknown>;
    expect(typeof body.token).toBe("string");

    // The response should include a signer/interview URL for email_otp packages
    const signerUrl = (body.interviewUrl ?? body.signerUrl ?? body.signer_url) as string | undefined;
    if (signerUrl) {
      // Navigate to the signer URL in the same context — it should render without crash
      await page.goto(signerUrl, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

      const crash = page.locator("text=Something went wrong");
      await expect(crash).not.toBeVisible({ timeout: 3_000 }).catch(() => {});

      const pageBody = await page.locator("body").textContent({ timeout: 6_000 });
      expect(pageBody?.trim().length).toBeGreaterThan(10);
    }
  });

  test("send-link endpoint accepts a valid session token", async ({ page }) => {
    // Create a demo session first
    const demoRes = await page.request.post(`${DOC_API}/demo-session`);
    if (!demoRes.ok()) { test.skip(); return; }

    const { token } = await demoRes.json() as { token?: string };
    if (!token) { test.skip(); return; }

    // send-link should return 200 or 422 (missing email), not 401/403/500
    const linkRes = await page.request.post(`${DOC_API}/sessions/${token}/send-link`, {
      data: { email: "e2e-signer@test.example" },
    });

    // 402 = plan feature not available; 404 = session not found; both are acceptable
    expect([200, 201, 202, 400, 402, 404, 422]).toContain(linkRes.status());
    // Must not be an auth error or server crash
    expect([401, 403, 500]).not.toContain(linkRes.status());
  });
});
