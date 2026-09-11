// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("Viewer login succeeds and redirects to dashboard with read-only nav", async ({
    page,
  }) => {
    // 1. Navigate to /login
    await page.goto("/login");

    // expect: Login form is visible
    const passwordInput = page.getByRole("textbox", { name: "Password" });
    const loginButton = page.getByRole("button", { name: "Login" });
    await expect(passwordInput).toBeVisible();
    await expect(loginButton).toBeVisible();

    // 2. Fill #password with "hacking things together" and click Login
    await passwordInput.fill("hacking things together");
    await loginButton.click();

    // expect: URL becomes /dashboard
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });

    // 3. Inspect the nav bar
    const topNav = page
      .getByRole("navigation")
      .filter({ hasText: "Hackerspace" });
    await expect(topNav).toBeVisible({ timeout: 15000 });

    // expect: 'Admin Mode' label is NOT present
    await expect(
      page.locator("div").filter({ hasText: /^Admin Mode$/ }),
    ).not.toBeVisible();

    // expect: 'Onboarding' nav link is NOT present
    await expect(
      page.getByRole("link", { name: "Onboarding" }),
    ).not.toBeVisible();

    // expect: Dashboard/Members/Meetups links and Logout button are present
    await expect(
      page.getByRole("link", { name: "Dashboard" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Members" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Meetups" }).first(),
    ).toBeVisible();
    await expect(topNav.getByRole("button", { name: "Logout" })).toBeVisible();
  });
});
