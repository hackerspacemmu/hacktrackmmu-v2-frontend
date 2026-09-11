// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("Show/hide password toggle switches input type", async ({ page }) => {
    // 1. Navigate to /login and fill #password with 'secretarial slave'
    await page.goto("/login");
    const passwordInput = page.locator("#password");
    const toggleButton = page.locator("#password + button");
    await passwordInput.click();
    await passwordInput.fill("secretarial slave");

    // expect: Input type is 'password' (masked) and the Eye icon button is visible
    await expect(passwordInput).toHaveAttribute("type", "password");
    await expect(passwordInput).toHaveValue("secretarial slave");
    await expect(toggleButton).toBeVisible();
    await expect(toggleButton.locator("svg")).toHaveClass(/lucide-eye\b/);

    // 2. Click the eye icon toggle button
    await toggleButton.click();

    // expect: Input type becomes 'text' and the typed password 'secretarial slave' is visible in plain text; icon switches to EyeOff
    await expect(passwordInput).toHaveAttribute("type", "text");
    await expect(passwordInput).toHaveValue("secretarial slave");
    await expect(toggleButton.locator("svg")).toHaveClass(/lucide-eye-off/);

    // 3. Click the toggle button again
    await toggleButton.click();

    // expect: Input type reverts to 'password' (masked)
    await expect(passwordInput).toHaveAttribute("type", "password");
    await expect(toggleButton.locator("svg")).toHaveClass(/lucide-eye\b/);
  });
});
