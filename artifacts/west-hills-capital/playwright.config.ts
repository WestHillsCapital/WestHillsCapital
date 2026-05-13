import { defineConfig, devices } from "@playwright/test";
import fs from "fs";

const BASE_URL =
  process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? "3000"}`;

const NIX_CHROMIUM =
  "/nix/store/5afrhwm7zqn1vb7p5z1mc2rkh2grsfgz-ungoogled-chromium-138.0.7204.100/bin/chromium";

const launchOptions = fs.existsSync(NIX_CHROMIUM)
  ? { executablePath: NIX_CHROMIUM, args: ["--no-sandbox", "--disable-setuid-sandbox"] }
  : { args: ["--no-sandbox"] };

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 1,
  reporter: [["list"], ["html", { outputFolder: "e2e/report", open: "never" }]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    launchOptions,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
