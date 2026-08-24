import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: "http://127.0.0.1:5173/safferni-web/",
    trace: "on-first-retry",
  },
  webServer: {
    command: "PORT=5173 BASE_PATH=/safferni-web/ pnpm run dev",
    cwd: ".",
    url: "http://127.0.0.1:5173/safferni-web/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});