// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("Admin login succeeds and redirects to dashboard", async ({ page }) => {
    // 1. Navigate to /login
    await page.goto("/login");

    // expect: Password textbox, Remember me checkbox, and Login button are visible
    const passwordInput = page.locator("#password");
    const loginButton = page.getByRole("button", { name: "Login" });
    await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: "Remember me" }),
    ).toBeVisible();
    await expect(loginButton).toBeVisible();

    // expect: 4-image carousel container is present
    await expect(
      page.getByRole("img", { name: "Login visual 1" }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: "Login visual 2" }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: "Login visual 3" }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: "Login visual 4" }),
    ).toBeVisible();

    // 2. Fill #password with "secretarial slave"
    await passwordInput.fill("secretarial slave");

    // expect: Field shows masked dots (type=password by default)
    await expect(passwordInput).toHaveAttribute("type", "password");
    await expect(passwordInput).toHaveValue("secretarial slave");

    // 3. Click Login
    await loginButton.click();

    // expect: Toast 'Login successfully! Redirecting you to main page' is visible immediately after click (assert right after the click, before any wait, since it auto-dismisses at 5s)
    await expect(
      page.getByText("Login successfully! Redirecting you to main page"),
    ).toBeVisible();

    // expect: URL becomes /dashboard
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });

    // expect: Nav bar shows 'Admin Mode' label and a Control Panel heading
    await expect(
      page.locator("div").filter({ hasText: /^Admin Mode$/ }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("heading", { name: "Control Panel" }),
    ).toBeVisible({ timeout: 15000 });
  });
});
