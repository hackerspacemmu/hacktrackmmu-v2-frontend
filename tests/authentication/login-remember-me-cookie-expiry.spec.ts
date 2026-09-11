// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("Remember me checkbox sets a longer-lived token cookie", async ({
    page,
  }) => {
    // 1. Navigate to /login, check the 'Remember me' checkbox, fill password 'secretarial slave', and click Login
    await page.goto("/login");

    const rememberMeCheckbox = page.getByRole("checkbox", {
      name: "Remember me",
    });
    const passwordInput = page.getByRole("textbox", { name: "Password" });
    const loginButton = page.getByRole("button", { name: "Login" });

    await rememberMeCheckbox.click();
    await passwordInput.fill("secretarial slave");
    await loginButton.click();

    // expect: Login succeeds and lands on /dashboard
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await expect(
      page.locator("div").filter({ hasText: /^Admin Mode$/ }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("heading", { name: "Control Panel" }),
    ).toBeVisible({ timeout: 15000 });

    // 2. Read the 'token' cookie's expiry attribute
    const cookies = await page.context().cookies();
    const tokenCookie = cookies.find((cookie) => cookie.name === "token");

    // expect: Cookie expiry is set roughly 30 days in the future (per Cookies.set(token, {expires:30}) in useAuthStore), not a session cookie
    expect(tokenCookie).toBeDefined();
    expect(tokenCookie!.expires).not.toBe(-1);

    const nowInSeconds = Date.now() / 1000;
    const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
    const twentyNineDaysInSeconds = 29 * 24 * 60 * 60;

    expect(tokenCookie!.expires).toBeGreaterThan(
      nowInSeconds + twentyNineDaysInSeconds,
    );
    expect(tokenCookie!.expires).toBeLessThan(
      nowInSeconds + thirtyDaysInSeconds + 60 * 60,
    );
  });
});
