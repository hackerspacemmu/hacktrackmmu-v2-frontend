// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Navigation & Layout", () => {
  test("Root route always shows the public landing page regardless of auth state", async ({
    page,
  }) => {
    const landingTitle = page.getByRole("heading", { level: 1 });
    const landingTagline = page.getByText(
      "Remembering and celebrating every shared talk",
    );
    // The button's label is split across two spans ("Login" and the arrow), so match on
    // the word alone -- it is the only button on the landing page.
    const loginButton = page.getByRole("button", { name: /Login/ });

    // 1. With no cookies set (logged out), navigate to /
    await page.goto("/");

    // expect: Landing page renders with the animated 'Hacktrack MMU' title, tagline
    // 'Remembering and celebrating every shared talk', and a 'Login →' button -- no
    // redirect occurs
    // AnimatedTitle splits the title into one <motion.span> per letter, so the <h1>'s
    // text content carries no space between the words; match it with a regex that
    // tolerates both that and the pre-mount plain-text fallback.
    await expect(landingTitle).toBeVisible({ timeout: 15000 });
    await expect(landingTitle).toHaveText(/Hacktrack\s*MMU/);
    await expect(landingTagline).toBeVisible();
    await expect(loginButton).toBeVisible();
    // AuthRedirectHandler in _app.tsx waits 200ms before bouncing an unauthenticated
    // visitor, and "/" is exempt from that check entirely. Sit past that window and
    // re-assert the URL, since the only way to prove a redirect does NOT happen is to
    // outlive the redirect's own delay.
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL("/");

    // 2. Click the 'Login →' button on the landing page
    // The plan lists this click last, after logging in. It is exercised here, while the
    // session is still logged out, because login.tsx's own useEffect pushes an
    // already-authenticated visitor straight to /dashboard: asserting on the
    // intermediate /login URL after authenticating would be a race against that bounce.
    // The routing behaviour under test -- the landing button targets /login -- is the
    // same in both states.
    await loginButton.click();

    // expect: Navigates to /login
    await expect(page).toHaveURL("/login", { timeout: 15000 });
    await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible();

    // 3. Log in as admin (submit 'secretarial slave'), then navigate back to /
    await page
      .getByRole("textbox", { name: "Password" })
      .fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await page.goto("/");

    // expect: Still shows the same public landing page (does NOT auto-redirect to
    // /dashboard) -- this is the same behavior as logged-out, confirming '/' never
    // checks auth
    await expect(landingTitle).toBeVisible({ timeout: 15000 });
    await expect(landingTitle).toHaveText(/Hacktrack\s*MMU/);
    await expect(landingTagline).toBeVisible();
    await expect(loginButton).toBeVisible();
    // Same reasoning as step 1: outlive any redirect delay before claiming none fired.
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL("/");
    // The nav bar only renders inside DashboardLayout, so its absence is a second,
    // structural confirmation that "/" served the public page rather than an
    // authenticated one.
    await expect(page.getByRole("navigation")).toHaveCount(0);
  });
});
