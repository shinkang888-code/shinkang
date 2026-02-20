import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3001",
    extraHTTPHeaders: { "Content-Type": "application/json" },
  },
  projects: [{ name: "api", use: { ...devices["Desktop Chrome"] } }],
  // Start dev server before tests
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3001",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
