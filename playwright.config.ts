import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["seed.spec.ts", "tests/**/*.spec.ts"],
  fullyParallel: true,
  reporter: "html",
  use: {
    baseURL: "http://localhost:8000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
