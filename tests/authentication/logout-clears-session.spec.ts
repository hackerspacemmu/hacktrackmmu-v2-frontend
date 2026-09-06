// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("Logout clears session, shows toast, and redirects to login", async ({
    page,
  }) => {
    // 1. Navigate to /login and log in as admin
    await page.goto("/login");

    const passwordInput = page.getByRole("textbox", { name: "Password" });
    await passwordInput.click();
    await passwordInput.fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();

    // expect: Lands on /dashboard
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await expect(
      page.locator("div").filter({ hasText: /^Admin Mode$/ }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("heading", { name: "Control Panel" }),
    ).toBeVisible({ timeout: 15000 });

    // 2. Click the 'Logout' button in the nav bar
    // The desktop nav AND the always-mounted off-canvas mobile Sidebar both render a
    // "Logout" button, so an unscoped getByRole('button', { name: 'Logout' }) matches two
    // elements and trips strict mode. Scope to the top nav landmark (identified by the
    // "Hackerspace" heading) to target the single visible desktop Logout button.
    const topNav = page
      .getByRole("navigation")
      .filter({ hasText: "Hackerspace" });

    // Register the response listener before clicking so the DELETE call isn't missed.
    // Match host-agnostically since the API runs on http://localhost:3000 while the app
    // is served from http://localhost:8000.
    const logoutResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/logout") &&
        response.request().method() === "DELETE",
    );

    await topNav.getByRole("button", { name: "Logout" }).click();

    // expect: Toast 'Logout successfully! Redirecting you to main page' appears.
    // Asserted first and with no preceding waits, since toasts auto-dismiss at exactly 5000ms.
    await expect(
      page.getByText("Logout successfully! Redirecting you to main page"),
    ).toBeVisible();

    // expect: DELETE /api/v1/logout is called
    await logoutResponsePromise;

    // expect: URL becomes /login
    await expect(page).toHaveURL("/login", { timeout: 15000 });

    // expect: the session is fully cleared — the auth cookies are gone
    await expect(async () => {
      const cookies = await page.context().cookies();
      expect(
        cookies.filter((c) =>
          ["token", "isAdmin", "validUntil"].includes(c.name),
        ),
      ).toEqual([]);
    }).toPass({ timeout: 5000 });

    // 3. Attempt to navigate back to /dashboard using browser back or direct URL
    await page.goto("/dashboard");

    // expect: Redirected back to /login since the token cookie/store was cleared
    await expect(page).toHaveURL("/login", { timeout: 15000 });

    // expect: this forced bounce reports itself as a forced bounce, NOT as a logout.
    // Regression guard: logout used to hand its toast off to AuthRedirectHandler via a
    // "manualLogout" localStorage flag that was never consumed, so the next protected-route
    // bounce wrongly replayed "Logout successfully!" instead of this message.
    await expect(
      page.getByText("You must be signed in to access this page."),
    ).toBeVisible({
      timeout: 3000,
    });
    await expect(
      page.getByText("Logout successfully! Redirecting you to main page"),
    ).not.toBeVisible();
  });
});
