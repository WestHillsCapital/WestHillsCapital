import { chromium, type FullConfig } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import path from "path";
import fs from "fs";

const AUTH_FILE = path.join(import.meta.dirname, ".auth/user.json");

export default async function globalSetup(_config: FullConfig) {
  const PORT = process.env.PORT ?? "3000";
  const BASE = process.env.BASE_URL ?? `http://localhost:${PORT}`;

  const isExternal = BASE.startsWith("https://") || (BASE.startsWith("http://") && !BASE.includes("localhost"));

  if (!process.env.CLERK_SECRET_KEY || isExternal) {
    const reason = isExternal
      ? `targeting external URL ${BASE} — skipping browser auth setup`
      : "CLERK_SECRET_KEY is not set — auth-dependent tests will be skipped";
    console.warn(`\n[e2e] ${reason}.\n`);
    fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: BASE });
  const page = await context.newPage();

  await setupClerkTestingToken({ page });
  await page.goto(`${BASE}/internal/docuplete`);
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  const res = await page.request.post(`${BASE}/api/internal/docuplete/seed-demo`).catch(() => null);
  if (res && res.ok()) {
    await page.waitForTimeout(1_500);
  }

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await context.storageState({ path: AUTH_FILE });
  await browser.close();
}
