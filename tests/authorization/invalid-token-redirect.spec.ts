// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Authorization", () => {
  test("An invalid/garbage token cookie is treated as unauthenticated and redirects to login", async ({
    page,
  }) => {
    // 1. Set a 'token' cookie to an arbitrary invalid string (e.g.
    // 'invalid_garbage_token_12345') and an 'isAdmin' cookie to 'true', then navigate to
    // /members
    //
    // Cookies must land on the app origin (http://localhost:8000) via addCookies BEFORE
    // navigating, so they are already present for AuthRedirectHandler's very first
    // checkToken() run on mount.
    await page.context().addCookies([
      {
        name: "token",
        value: "invalid_garbage_token_12345",
        url: "http://localhost:8000",
      },
      {
        name: "isAdmin",
        value: "true",
        url: "http://localhost:8000",
      },
    ]);

    // Unlike the sibling "no cookie at all" spec, useAuthStore.checkToken() only
    // short-circuits when the token is literally absent -- a present-but-garbage token is
    // NOT skipped, so GET /api/v1/sessions/verify genuinely fires here. Build the wait
    // promise BEFORE navigating so the request can't be missed, and match by substring
    // since the Rails API (localhost:3000) is a different origin from the app's baseURL.
    const verifyResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/api/v1/sessions/verify"),
    );

    await page.goto("/members");

    // expect: GET /api/v1/sessions/verify responds unsuccessfully for the bogus token
    // Confirmed live against the running backend: an invalid token yields 401 with
    // {"valid":false}, not a 200.
    const verifyResponse = await verifyResponsePromise;
    expect(verifyResponse.ok()).toBe(false);
    expect(verifyResponse.status()).toBe(401);

    // expect: Page redirects to /login within ~200ms
    // toHaveURL polls/auto-waits, which naturally covers AuthRedirectHandler's 200ms
    // setTimeout before it clears the store and calls router.replace("/login").
    await expect(page).toHaveURL("/login");

    // expect: The login form (not the members page) is what the user ultimately sees
    await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
  });
});
