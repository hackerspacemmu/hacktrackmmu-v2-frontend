// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Navigation & Layout", () => {
  test("Desktop nav shows admin-only links and Admin Mode label for admin", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, at a desktop viewport (the config default
    //    1280x720 Desktop Chrome viewport is fine)
    await page.goto("/login");
    await page
      .getByRole("textbox", { name: "Password" })
      .fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });

    // Scope every assertion to the top nav bar. The slide-in Sidebar is a SIBLING of
    // this <nav> and renders the same link texts, an 'Admin Mode' text and a Logout
    // button. When closed it is only translated off-screen (-translate-x-full), which
    // Playwright still reports as visible, so unscoped locators would be strict-mode
    // violations / could match the wrong (sidebar) element. The top nav is the first
    // "navigation" landmark on the page; the sidebar's own <nav> is the second.
    const desktopNav = page.getByRole("navigation").first();

    // expect: Top nav bar shows Dashboard, Members, Meetups, Onboarding links, an
    // 'Admin Mode' text label, and a Logout button
    await expect(
      desktopNav.getByRole("link", { name: "Dashboard" }),
    ).toBeVisible();
    await expect(
      desktopNav.getByRole("link", { name: "Members" }),
    ).toBeVisible();
    await expect(
      desktopNav.getByRole("link", { name: "Meetups" }),
    ).toBeVisible();
    // The Onboarding link is additionally gated on `isClient && isAdmin`, so give it a
    // timeout to appear once client-side hydration completes.
    await expect(
      desktopNav.getByRole("link", { name: "Onboarding" }),
    ).toBeVisible({ timeout: 15000 });
    // 'Admin Mode' is a plain <div> with no accessible role, so it's matched by its
    // exact text, scoped inside the desktop nav to avoid the sidebar's copy.
    await expect(
      desktopNav.locator("div").filter({ hasText: /^Admin Mode$/ }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      desktopNav.getByRole("button", { name: "Logout" }),
    ).toBeVisible();

    // expect: The mobile hamburger button is not visible at this width
    // The hamburger lives in `div.block.lg:hidden`; Tailwind's `hidden` sets a real
    // display:none at/above the `lg` breakpoint, so this is a genuine responsive check
    // at the 1280px desktop viewport (rather than just an off-screen transform).
    await expect(page.locator("div.block.lg\\:hidden")).toBeHidden();
  });
});
