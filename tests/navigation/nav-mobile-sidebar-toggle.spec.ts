// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Navigation & Layout", () => {
  test("Mobile hamburger button opens and closes the slide-in sidebar", async ({
    page,
  }) => {
    // The mobile-only steps below were written from
    // src/components/NavigationBar/index.tsx and src/components/NavigationBar/sidebar.tsx
    // rather than captured interactively, because the recording tools could not reach a
    // 375px viewport and the hamburger is display:none above the `lg` breakpoint. The
    // test has since been run against the app and passes, so the selectors are confirmed.

    // 1. Navigate to /login, log in as admin, resize viewport to 375x812
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/login");
    await page
      .getByRole("textbox", { name: "Password" })
      .fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });

    // expect: Top nav collapses to just the logo and a hamburger (Menu icon) button;
    // full-width desktop links are hidden
    // The desktop links/Admin Mode+Logout live in `div.hidden lg:flex` containers; the
    // hamburger lives in `div.block lg:hidden`. Tailwind's `hidden`/`block` are real
    // display switches at the `lg` (1024px) breakpoint, so at 375px the former is
    // genuinely hidden and the latter is visible.
    const desktopContainers = page.locator("div.hidden.lg\\:flex");
    await expect(desktopContainers.first()).toBeHidden();
    await expect(desktopContainers.last()).toBeHidden();
    const mobileNavContainer = page.locator("div.block.lg\\:hidden");
    await expect(mobileNavContainer).toBeVisible();
    const hamburgerButton = mobileNavContainer.getByRole("button");
    await expect(hamburgerButton).toBeVisible();
    // lucide-react renders <svg class="lucide lucide-menu"> for <Menu/>; scope to the
    // hamburger button so the assertion can't match an unrelated svg on the page.
    await expect(hamburgerButton.locator("svg.lucide-menu")).toBeVisible();

    // The Sidebar is a sibling of the top <nav>, always mounted, and only ever
    // transform-translated / opacity-toggled — never unmounted or display:none. So
    // toBeVisible()/toBeHidden() is not a valid open/closed signal for it; assert on the
    // class attribute instead.
    const overlay = page.locator("div.fixed.inset-0.bg-black.bg-opacity-50");
    const sidebar = page.locator("div.fixed.top-0.left-0.w-64");

    // 2. Click the hamburger button
    await hamburgerButton.click();

    // expect: Icon switches to an X (close) icon
    await expect(hamburgerButton.locator("svg.lucide-x")).toBeVisible();

    // expect: A sidebar panel slides in from the left with a semi-transparent overlay
    // behind it, containing Dashboard/Members/Meetups/Onboarding links, 'Admin Mode'
    // text, and a Logout button
    await expect(sidebar).toHaveClass(/translate-x-0/);
    await expect(overlay).toHaveClass(/opacity-100/);
    // Scope all of the following to the sidebar panel — the top <nav> renders the same
    // link texts, 'Admin Mode' text and Logout button, so unscoped locators would be
    // strict-mode violations.
    await expect(
      sidebar.getByRole("link", { name: "Dashboard" }),
    ).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Members" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Meetups" })).toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: "Onboarding" }),
    ).toBeVisible();
    await expect(sidebar.getByText("Admin Mode")).toBeVisible();
    await expect(sidebar.getByRole("button", { name: "Logout" })).toBeVisible();

    // 3. Click the overlay (outside the sidebar)
    // The overlay is full-screen but the 256px-wide (w-64) sidebar sits on top of it at
    // z-50, covering x=0..256. A plain overlay.click() would target the overlay's centre
    // (x≈187 at 375px wide), which the sidebar would intercept. Click a point clear of
    // the panel instead (x=340, well past the 256px-wide sidebar, at y=400 which is below
    // the sidebar's close-button row and inside the nav links area).
    await overlay.click({ position: { x: 340, y: 400 } });

    // expect: Sidebar slides back off-screen and the overlay disappears
    await expect(sidebar).toHaveClass(/-translate-x-full/);
    await expect(overlay).toHaveClass(/opacity-0 pointer-events-none/);
  });
});
