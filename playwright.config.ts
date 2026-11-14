import { defineConfig, devices } from "@playwright/test";

const APP_PORT = Number(process.env.E2E_APP_PORT ?? 3100);
const SYNC_PORT = 1234; // must match NEXT_PUBLIC_SYNC_URL used for the build (default ws://localhost:1234)

/**
 * End-to-end tests run against a production build (`npm run build` first) plus the real
 * sync server. Judge0 is deliberately NOT configured, so the "configuration required" path
 * is exercised for real; successful runs are mocked at the browser's network layer.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1400, height: 900 } } }],
  webServer: [
    {
      command: "node sync-server/src/index.js",
      url: `http://127.0.0.1:${SYNC_PORT}/healthz`,
      env: { PORT: String(SYNC_PORT), HOST: "127.0.0.1", ALLOWED_ORIGINS: "" },
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `npx next start -p ${APP_PORT}`,
      url: `http://localhost:${APP_PORT}`,
      env: { JUDGE0_URL: "", NEXT_TELEMETRY_DISABLED: "1" },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
