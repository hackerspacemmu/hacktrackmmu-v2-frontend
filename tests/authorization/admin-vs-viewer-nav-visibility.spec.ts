// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Authorization", () => {
  test("Admin sees Onboarding link and Admin Mode label; viewer does not", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in with admin password 'secretarial slave'
    await page.goto("/login");

    const passwordInput = page.getByRole("textbox", { name: "Password" });
    const loginButton = page.getByRole("button", { name: "Login" });
    await passwordInput.fill("secretarial slave");
    await loginButton.click();

    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });

    // Scope every assertion to the top nav bar. The slide-in Sidebar is a SIBLING of
    // this <nav> and renders the same link texts and its own 'Admin Mode' text; when
    // closed it is only translated off-screen (-translate-x-full), which Playwright
    // still reports as visible, so an unscoped locator would be a strict-mode hazard
    // (or could silently match the sidebar copy instead). The top nav is the first
    // "navigation" landmark on the page; the sidebar's own <nav> is the second. See
    // tests/navigation/nav-desktop-admin-links.spec.ts, which this follows.
    const topNav = page.getByRole("navigation").first();

    // expect: Nav shows 'Onboarding' link and 'Admin Mode' text
    // Both are gated on `isClient && isAdmin` in NavigationBar, so give them a timeout
    // to appear once client-side hydration completes.
    await expect(
      topNav.getByRole("link", { name: "Onboarding" }),
    ).toBeVisible({ timeout: 15000 });
    // 'Admin Mode' is a plain <div> with no accessible role, so it's matched by its
    // exact text, scoped inside the top nav to avoid the sidebar's copy.
    await expect(
      topNav.locator("div").filter({ hasText: /^Admin Mode$/ }),
    ).toBeVisible({ timeout: 15000 });

    // 2. Log out, then log in again with viewer password 'hacking things together'
    await topNav.getByRole("button", { name: "Logout" }).click();

    // Wait for the actual navigation to /login before reusing the password field —
    // logout pushes the route before clearing auth state, so this is the real signal
    // the previous (admin) page has been torn down.
    await expect(page).toHaveURL("/login", { timeout: 15000 });

    await passwordInput.fill("hacking things together");
    await loginButton.click();

    // Anchor on a real signal that the second login has fully completed before
    // asserting the absence of admin-only elements below. An absence assertion that
    // runs too early would pass for the wrong reason (e.g. against a stale admin nav
    // that hasn't unmounted yet), so wait for the URL change first.
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await expect(topNav.getByRole("button", { name: "Logout" })).toBeVisible({
      timeout: 15000,
    });

    // The Logout button alone is NOT a sufficient anchor -- the admin nav renders it
    // too, so it cannot distinguish "the viewer nav has rendered" from "the admin nav
    // is still on screen". The role flip itself is what has to be observed: login.tsx
    // calls setAdmin(response.data.isAdmin), which writes the isAdmin cookie
    // (useAuthStore.setAdmin) from the same value the nav reads. Polling it to "false"
    // proves the store really did switch roles, so the absence checks below can only
    // pass because the admin-only elements are gone -- not because the nav had yet to
    // re-render.
    await expect
      .poll(
        async () => {
          const cookies = await page.context().cookies();
          return cookies.find((cookie) => cookie.name === "isAdmin")?.value;
        },
        { timeout: 15000 },
      )
      .toBe("false");

    // expect: Nav no longer shows an 'Onboarding' link or 'Admin Mode' text
    await expect(
      topNav.getByRole("link", { name: "Onboarding" }),
    ).not.toBeVisible();
    await expect(
      topNav.locator("div").filter({ hasText: /^Admin Mode$/ }),
    ).not.toBeVisible();

    // expect: Dashboard/Members/Meetups links and Logout remain
    await expect(
      topNav.getByRole("link", { name: "Dashboard" }),
    ).toBeVisible();
    await expect(topNav.getByRole("link", { name: "Members" })).toBeVisible();
    await expect(topNav.getByRole("link", { name: "Meetups" })).toBeVisible();
    await expect(topNav.getByRole("button", { name: "Logout" })).toBeVisible();
  });
});
