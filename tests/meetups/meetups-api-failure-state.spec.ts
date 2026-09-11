// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Meetups", () => {
  test("Meetups page shows an error state when the meetups API call fails", async ({
    page,
  }) => {
    // 1. Navigate to /login and log in as admin
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Password" }).fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();

    // expect: Login succeeds
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });

    // 2. Intercept GET requests matching /api/v1/meetups to fail with a 500 response, then
    //    navigate to /meetups
    // Matched by pathname rather than a baseURL-rooted glob: the Rails API is served from
    // http://localhost:3000 while the app itself runs on http://localhost:8000. The page
    // requests `/api/v1/meetups/?page=N` (note the trailing slash), so the prefix test
    // covers it while still leaving the unrelated `/api/v1/dashboard/meetups` call alone.
    await page.route(
      (url) => url.pathname.startsWith("/api/v1/meetups"),
      async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Internal Server Error" }),
        });
      },
    );

    await page.goto("/meetups");

    // expect: The ErrorPage component renders instead of the meetup/hackathon grids
    // meetups.tsx catches the axios failure, sets isError, and returns <ErrorPage />.
    // "occured" is spelt that way in src/components/errorComponent.tsx, so the assertion
    // matches the real string rather than the corrected spelling.
    await expect(
      page.getByRole("heading", { name: "An error occured!" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("heading", {
        name: "Please report this issue to hackerspace developers.",
      }),
    ).toBeVisible({ timeout: 5000 });

    // The ErrorPage branch replaces the whole DashboardLayout, so neither section heading
    // nor any meetup/hackathon card should remain.
    await expect(
      page.getByRole("heading", { name: "Regular Meetups" }),
    ).not.toBeVisible({ timeout: 3000 });
    await expect(
      page.getByRole("heading", { name: "Hackathons" }),
    ).not.toBeVisible({ timeout: 3000 });
    await expect(page.getByRole("heading", { name: /^Meetup \d+/ })).toHaveCount(
      0,
      { timeout: 3000 },
    );
    await expect(
      page.getByRole("heading", { name: /^Hackathon \d+/ }),
    ).toHaveCount(0, { timeout: 3000 });
  });
});
