import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/ui",
  timeout: 180_000,
  fullyParallel: true, // MAXIMUM CONCURRENCY
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? "100%" : "80%", // Use most of the CPU cores for Flash tests
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      scale: "css",
    },
  },
  snapshotPathTemplate: "{testDir}/baseline/{testFilePath}/{arg}{ext}",
  // Reporter includes HTML for the visual dashboards
  reporter: [["html", { outputFolder: "playwright-report" }], ["list"]],
  // Setup global authentication so workers don't need to login repeatedly
  globalSetup: require.resolve('./tests/global-setup'),
  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
    viewport: { width: 1600, height: 900 },
    colorScheme: "dark",
    video: "on",
    // Use the saved authentication state
    storageState: "tests/.auth/user.json",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1600, height: 900 }, colorScheme: "dark" },
    },
  ],
});
