// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("Invalid password shows error toast and stays on login", async ({
    page,
  }) => {
    // 1. Navigate to /login
    await page.goto("/login");

    // expect: Login form is visible
    const passwordInput = page.getByRole("textbox", { name: "Password" });
    const loginButton = page.getByRole("button", { name: "Login" });
    await expect(passwordInput).toBeVisible();
    await expect(loginButton).toBeVisible();

    // 2. Fill #password with "wrong-password-123" and click Login
    await passwordInput.fill("wrong-password-123");
    const loginResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/api/v1/login"),
    );
    await loginButton.click();

    // expect: Toast reads exactly 'Invalid password. Try again.' and is visible ~71ms after submit
    // (assert immediately after the click, never via a text-based wait, since the toast
    // auto-dismisses ~5.4s after appearing)
    await expect(page.getByText("Invalid password. Try again.")).toBeVisible();

    // expect: POST /api/v1/login responds 401 with body {"message":"Invalid password"}
    const loginResponse = await loginResponsePromise;
    expect(loginResponse.status()).toBe(401);
    expect(await loginResponse.json()).toEqual({ message: "Invalid password" });

    // expect: URL remains /login
    await expect(page).toHaveURL("/login");
  });
});
