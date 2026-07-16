import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    viewport: {
      width: 390,
      height: 844
    }
  },
  webServer: [
    {
      command: "pnpm --filter @asysha-pro/api dev",
      reuseExistingServer: true,
      timeout: 120_000,
      url: "http://127.0.0.1:4000/api/health"
    },
    {
      command: "pnpm --filter @asysha-pro/web dev",
      reuseExistingServer: true,
      timeout: 120_000,
      url: "http://127.0.0.1:5173"
    }
  ]
});
