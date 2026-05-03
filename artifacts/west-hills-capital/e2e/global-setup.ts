import { chromium, type FullConfig } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import path from "path";
import fs from "fs";

const AUTH_FILE = path.join(import.meta.dirname, ".auth/user.json");

export default async function globalSetup(_config: FullConfig) {
  const PORT = process.env.PORT ?? "3000";
  const BASE = `http://localhost:${PORT}`;

  if (!process.env.CLERK_SECRET_KEY) {
    console.warn(
      "\n[e2e] CLERK_SECRET_KEY is not set — writing empty auth state. " +
      "Auth-dependent tests will be skipped.\n"
    );
    fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: BASE });
  const page = await context.newPage();

  await setupClerkTestingToken({ page });
  await page.goto(`${BASE}/internal/docufill`);
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  const res = await page.request.post(`${BASE}/api/internal/docufill/seed-demo`).catch(() => null);
  if (res && res.ok()) {
    await page.waitForTimeout(1_500);
  }

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await context.storageState({ path: AUTH_FILE });
  await browser.close();
}
