// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Members", () => {
  test("Members page shows an error state when the members API call fails", async ({
    page,
  }) => {
    // 1. Navigate to /login and log in as admin
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Password" }).fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();

    // expect: Login succeeds
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });

    // 2. Intercept GET requests matching /api/v1/members/filtered to fail with a 500
    //    response, then navigate to /members
    // Matched by pathname rather than a baseURL-rooted glob: the Rails API is served from
    // http://localhost:3000 while the app itself runs on http://localhost:8000. The
    // pathname is matched exactly so this cannot also swallow /api/v1/members/search or
    // /api/v1/dashboard/members.
    await page.route(
      (url) => url.pathname === "/api/v1/members/filtered",
      async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Internal Server Error" }),
        });
      },
    );

    await page.goto("/members");

    // expect: The dedicated ErrorPage component renders instead of the member grid
    // src/pages/members.tsx returns <ErrorPage /> as soon as SWR reports an error, and
    // src/components/errorComponent.tsx renders this heading -- "occured" is spelt that
    // way in the source, so the assertion matches the real string rather than the
    // corrected one.
    await expect(
      page.getByRole("heading", { name: "An error occured!" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("heading", {
        name: "Please report this issue to hackerspace developers.",
      }),
    ).toBeVisible({ timeout: 5000 });

    // The ErrorPage branch returns early in place of the whole DashboardLayout, so none
    // of the members chrome -- heading, search box, filter, or any member card -- should
    // remain on the page.
    await expect(
      page.getByRole("heading", { name: "Members", level: 1 }),
    ).not.toBeVisible({ timeout: 3000 });
    await expect(
      page.getByRole("textbox", { name: "Search members..." }),
    ).not.toBeVisible({ timeout: 3000 });
    await expect(
      page.locator("div.grid > div").filter({ hasText: /\d+ Projects/ }),
    ).toHaveCount(0, { timeout: 3000 });
  });
});
