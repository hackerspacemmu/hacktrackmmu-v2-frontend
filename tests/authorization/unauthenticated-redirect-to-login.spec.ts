// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Authorization", () => {
  test("Unauthenticated access to a protected route redirects to login with a warning toast", async ({
    page,
  }) => {
    // Each Playwright test already gets a fresh context with no cookies (fullyParallel
    // relies on that), but clear explicitly so this read-only scenario is provably
    // unaffected by anything else -- and never logs in, since it only exercises the
    // logged-out redirect.
    await page.context().clearCookies();

    // AuthRedirectHandler's verify check (useAuthStore.checkToken) only calls
    // GET /api/v1/sessions/verify when a token cookie is actually present. With no
    // cookie at all the in-memory token stays the "0" placeholder and checkToken() sets
    // isValidToken=false synchronously, never touching the network (verified against the
    // running app: no sessions/verify request fires for any of the three navigations
    // below). So "the verify call fails" surfaces here as "the call is never attempted";
    // what the plan really cares about -- the redirect-to-login-with-toast contract that
    // failure drives -- is what the assertions below check.
    const verifyRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/v1/sessions/verify")) {
        verifyRequests.push(request.url());
      }
    });

    const warningToast = page.getByText(
      "You must be signed in to access this page.",
    );

    // 1. With no cookies set, navigate directly to /dashboard
    await page.goto("/dashboard");

    // expect: After ~200ms, the page redirects to /login
    await expect(page).toHaveURL("/login");

    // expect: Toast 'You must be signed in to access this page.' appears -- assert
    // immediately after the redirect settles, not via a delayed text-based wait, since it
    // auto-dismisses at exactly 5s.
    await expect(warningToast).toBeVisible();

    // expect: GET /api/v1/sessions/verify fails (no/invalid token) -- see the comment
    // above: with no token cookie present it never fires at all. Checking here, after the
    // redirect and toast have already been observed, guarantees checkToken()'s one-time
    // decision has already been made.
    expect(verifyRequests).toEqual([]);

    // 2. Repeat by navigating directly to /members and to /meetups with no cookies set
    await page.goto("/members");

    // expect: Both also redirect to /login with the same behavior
    await expect(page).toHaveURL("/login");
    await expect(warningToast).toBeVisible();
    expect(verifyRequests).toEqual([]);

    await page.goto("/meetups");

    await expect(page).toHaveURL("/login");
    await expect(warningToast).toBeVisible();
    expect(verifyRequests).toEqual([]);
  });
});
