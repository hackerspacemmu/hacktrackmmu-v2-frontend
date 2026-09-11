// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("Dashboard shows an error state when the meetups API call fails", async ({
    page,
  }) => {
    // 1. Navigate to /login and log in as admin
    await page.goto("/login");
    const passwordInput = page.getByRole("textbox", { name: "Password" });
    await passwordInput.fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();

    // expect: Login succeeds
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await expect(
      page.getByRole("heading", { name: "Control Panel" }),
    ).toBeVisible({ timeout: 15000 });

    // 2. Intercept/route GET requests matching /api/v1/dashboard/meetups to fail with a
    //    500 response, then reload /dashboard
    // Matched by pathname rather than a baseURL-rooted glob: the Rails API is served from
    // http://localhost:3000 while the app itself runs on http://localhost:8000.
    // The pathname is matched exactly so this cannot also swallow
    // /api/v1/dashboard/hackathons or /api/v1/dashboard/members.
    await page.route(
      (url) => url.pathname === "/api/v1/dashboard/meetups",
      async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Internal Server Error" }),
        });
      },
    );

    await page.reload();

    // expect: Page renders the 'Error loading dashboard meetups.' heading instead of the
    // normal dashboard layout
    await expect(
      page.getByRole("heading", { name: "Error loading dashboard meetups." }),
    ).toBeVisible({ timeout: 15000 });

    // The error branch in src/pages/dashboard.tsx returns early, replacing the whole
    // layout, so none of the normal dashboard chrome should remain.
    await expect(
      page.getByRole("heading", { name: "Control Panel" }),
    ).not.toBeVisible({ timeout: 3000 });
    await expect(
      page.getByRole("heading", { name: "Active Members", exact: true }),
    ).not.toBeVisible({ timeout: 3000 });
  });
});
