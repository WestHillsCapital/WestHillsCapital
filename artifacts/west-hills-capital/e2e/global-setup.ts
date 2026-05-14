import { chromium, type FullConfig } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import path from "path";
import fs from "fs";

const AUTH_FILE = path.join(import.meta.dirname, ".auth/user.json");

const NIX_CHROMIUM =
  "/nix/store/5afrhwm7zqn1vb7p5z1mc2rkh2grsfgz-ungoogled-chromium-138.0.7204.100/bin/chromium";

export default async function globalSetup(_config: FullConfig) {
  const PORT = process.env.PORT ?? "3000";
  const BASE = process.env.BASE_URL ?? `http://localhost:${PORT}`;

  const isExternal =
    BASE.startsWith("https://") ||
    (BASE.startsWith("http://") && !BASE.includes("localhost"));

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  // --- Production: real browser login via E2E_EMAIL + E2E_TEST_PASSWORD ---
  if (isExternal && process.env.E2E_EMAIL && process.env.E2E_TEST_PASSWORD) {
    console.log(`\n[e2e] logging in to ${BASE} as ${process.env.E2E_EMAIL}...\n`);

    const executablePath = fs.existsSync(NIX_CHROMIUM) ? NIX_CHROMIUM : undefined;
    const browser = await chromium.launch({
      executablePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const context = await browser.newContext({ baseURL: BASE });
    const page = await context.newPage();

    // Navigate to sign-in
    await page.goto(`${BASE}/app/sign-in`, { waitUntil: "domcontentloaded" });

    // Step 1: fill email and press Enter
    // (pressing Enter avoids accidentally clicking "Continue with Google")
    const emailInput = page.locator("input[name='identifier']").first();
    await emailInput.waitFor({ state: "visible", timeout: 15_000 });
    await emailInput.fill(process.env.E2E_EMAIL!);
    await emailInput.press("Enter");

    // Step 2: Clerk navigates to /factor-one where the password field is enabled.
    await page.waitForURL(/sign-in\/factor-one/, { timeout: 15_000 });
    const passwordInput = page.locator("input[name='password']").first();
    await passwordInput.waitFor({ state: "visible", timeout: 10_000 });
    await passwordInput.fill(process.env.E2E_TEST_PASSWORD!);
    await passwordInput.press("Enter");

    // Step 3: Wait until we fully leave sign-in (any sign-in sub-path)
    await page
      .waitForURL((url) => !url.pathname.startsWith("/app/sign-in"), { timeout: 20_000 })
      .catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    const finalUrl = page.url();
    if (finalUrl.includes("sign-in")) {
      console.warn("[e2e] WARNING: still on sign-in page after login attempt — auth may have failed.");
    } else {
      console.log(`[e2e] logged in successfully, landed at ${finalUrl}`);
    }

    await context.storageState({ path: AUTH_FILE });
    await browser.close();
    return;
  }

  // --- External URL without credentials: skip auth, run only unauthenticated tests ---
  if (isExternal) {
    console.warn(
      `\n[e2e] targeting external URL ${BASE} — E2E_EMAIL not set, skipping auth setup.\n`
    );
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }

  // --- Dev: no CLERK_SECRET_KEY, skip auth ---
  if (!process.env.CLERK_SECRET_KEY) {
    console.warn("\n[e2e] CLERK_SECRET_KEY is not set — auth-dependent tests will be skipped.\n");
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }

  // --- Dev: use Clerk testing token (bypasses real login) ---
  const executablePath = fs.existsSync(NIX_CHROMIUM) ? NIX_CHROMIUM : undefined;
  const browser = await chromium.launch({
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const context = await browser.newContext({ baseURL: BASE });
  const page = await context.newPage();

  await setupClerkTestingToken({ page });
  await page.goto(`${BASE}/internal/docuplete`);
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  const res = await page.request
    .post(`${BASE}/api/internal/docuplete/seed-demo`)
    .catch(() => null);
  if (res && res.ok()) {
    await page.waitForTimeout(1_500);
  }

  await context.storageState({ path: AUTH_FILE });
  await browser.close();
}
