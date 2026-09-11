// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Authorization", () => {
  test("Session expiring mid-session (verify call starts failing) bounces the user to login", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, land on /dashboard
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Password" }).fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();

    // expect: Dashboard loaded normally with a valid token
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await expect(
      page.getByRole("heading", { name: "Control Panel" }),
    ).toBeVisible({ timeout: 15000 });

    // 2. Intercept/route GET /api/v1/sessions/verify to start returning a failure (e.g. 401)
    // for all subsequent calls, then trigger a route change (e.g. click 'Members' in the nav)
    //
    // Matched by pathname rather than a baseURL-rooted glob: the Rails API is served from
    // http://localhost:3000 while the app itself runs on http://localhost:8000. This follows
    // the same house pattern as tests/dashboard/dashboard-api-failure-state.spec.ts.
    await page.route(
      (url) => url.pathname === "/api/v1/sessions/verify",
      async (route) => {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ valid: false }),
        });
      },
    );

    // Verified live against the running app before writing this test: AuthRedirectHandler's
    // effect that calls checkToken() (src/pages/_app.tsx) has dependency array
    // [isClient, checkToken, token] -- router.pathname is NOT among them, and the component
    // stays mounted across pages-router client-side navigations. Counting performance
    // resource entries for /api/v1/sessions/verify before and after clicking a nav link
    // showed the count never changed, and the app never bounced. So, contrary to the plan's
    // literal wording, a client-side nav click alone does NOT re-trigger a verify check here.
    // Record any verify request the click provokes. `toHaveURL("/members")` alone cannot
    // support the no-bounce claim below -- it is satisfied the instant the URL changes,
    // which is BEFORE the ~200ms window in which a bounce would land, so it cannot tell
    // "never bounced" apart from "hasn't bounced yet". Watching for the request itself is
    // the direct evidence.
    const verifyRequestsAfterClick: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/v1/sessions/verify")) {
        verifyRequestsAfterClick.push(request.url());
      }
    });

    await page.getByRole("link", { name: "Members" }).first().click();

    // expect (documenting the discrepancy, not the plan's literal expectation): the SPA
    // navigation completes normally and the stale isValidToken=true is never re-evaluated,
    // so there is no bounce from the click alone.
    //
    // Waiting for the members list to actually render real cards -- rather than an
    // arbitrary fixed delay -- carries the check well past the 200ms bounce window, so
    // the URL assertion that follows reflects where the app SETTLED. Real MemberCards
    // only: SkeletonMemberCard renders the same grid shape with an empty pulse
    // placeholder, and every real card renders "<n> Projects" while no skeleton does.
    await expect(
      page.locator("div.grid > div").filter({ hasText: /\d+ Projects/ }).first(),
    ).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL("/members");
    expect(verifyRequestsAfterClick).toEqual([]);

    // What genuinely re-triggers the check is anything that remounts AuthRedirectHandler
    // (isClient flips false -> true again on mount) -- a full page load does that. Verified
    // live: reloading fired a fresh GET /api/v1/sessions/verify every time, unlike the nav
    // click above. Build the wait promise before reloading so the request can't be missed.
    const verifyResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/api/v1/sessions/verify"),
    );
    await page.reload();

    // expect: AuthRedirectHandler's next verify check fails
    const verifyResponse = await verifyResponsePromise;
    expect(verifyResponse.status()).toBe(401);

    // expect: After ~200ms the app clears the auth store and redirects to /login
    // toHaveURL polls/auto-waits, which naturally covers AuthRedirectHandler's 200ms
    // setTimeout before it clears the store and calls router.replace("/login").
    await expect(page).toHaveURL("/login");

    // expect: Toast 'You must be signed in to access this page.' appears immediately after
    // the redirect -- assert right away, never via a delayed text-based wait, since it
    // auto-dismisses at exactly 5s.
    await expect(
      page.getByText("You must be signed in to access this page."),
    ).toBeVisible();
  });
});
