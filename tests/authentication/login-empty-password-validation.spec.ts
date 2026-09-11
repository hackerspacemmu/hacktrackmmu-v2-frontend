// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("Empty password blocks submission via native required validation", async ({
    page,
  }) => {
    // 1. Navigate to /login
    await page.goto("/login");

    // expect: Password field is present and empty
    const passwordInput = page.locator("#password");
    const loginButton = page.getByRole("button", { name: "Login" });
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveValue("");

    // 2. Click Login without typing a password
    const loginRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/v1/login")) {
        loginRequests.push(request.url());
      }
    });
    await loginButton.click();

    // expect: Browser's native 'required' validation prevents form submission (no POST /api/v1/login network request fires)
    // Give any async submission a brief window to fire via waitForRequest (a real wait
    // primitive, not an arbitrary timeout); native `required` validation blocks form
    // submission synchronously, so no matching request is ever expected to appear.
    await page
      .waitForRequest((request) => request.url().includes("/api/v1/login"), {
        timeout: 500,
      })
      .catch(() => null);
    expect(loginRequests).toHaveLength(0);

    // Native validation keeps the field empty and refocuses it as the blocked submit target
    await expect(passwordInput).toHaveValue("");
    await expect(passwordInput).toBeFocused();

    // expect: URL remains /login
    await expect(page).toHaveURL("/login");
  });
});
