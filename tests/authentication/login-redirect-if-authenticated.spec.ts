// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("Visiting /login while already authenticated redirects to dashboard", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin ('secretarial slave')
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

    // 2. Navigate directly to /login again while the token cookie is still valid
    await page.goto("/login");

    // expect: The login form (password textbox) is never left visible, since login.tsx's useEffect
    // checks the token cookie and pushes to /dashboard before rendering the form
    await expect(passwordInput).not.toBeVisible();

    // expect: Page immediately redirects back to /dashboard
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
  });
});
