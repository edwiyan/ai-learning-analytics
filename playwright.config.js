import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./qa-audit/specs",
  outputDir: "./qa-audit/traces",
  timeout: 30000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  retries: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "qa-audit/playwright-report", open: "never" }],
  ],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on",
    screenshot: "on",
    video: "off",
    headless: true,
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
