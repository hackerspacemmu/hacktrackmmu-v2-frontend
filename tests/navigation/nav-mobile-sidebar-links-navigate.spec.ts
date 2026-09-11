// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Navigation & Layout", () => {
  test("Sidebar links navigate correctly on mobile", async ({ page }) => {
    // 1. Navigate to /login, log in as admin, resize to 375x812, open the sidebar via
    //    the hamburger button
    // The viewport is set before the first navigation so the nav renders in its mobile
    // form from the outset rather than re-laying out mid-test.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/login");
    await page
      .getByRole("textbox", { name: "Password" })
      .fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });

    // The hamburger lives in `div.block lg:hidden`; Tailwind's `block`/`hidden` are real
    // display switches at the `lg` (1024px) breakpoint, so at 375px this container is the
    // only nav control rendered.
    const mobileNavContainer = page.locator("div.block.lg\\:hidden");
    const hamburgerButton = mobileNavContainer.getByRole("button");
    await expect(hamburgerButton).toBeVisible({ timeout: 15000 });
    await hamburgerButton.click();

    // expect: Sidebar open with nav links visible
    // The Sidebar is a sibling of the top <nav>, always mounted, and only ever
    // transform-translated -- never unmounted or display:none -- so toBeVisible() is not
    // a valid open/closed signal for it. Assert on the class attribute instead.
    const sidebar = page.locator("div.fixed.top-0.left-0.w-64");
    const overlay = page.locator("div.fixed.inset-0.bg-black.bg-opacity-50");
    await expect(sidebar).toHaveClass(/translate-x-0/);
    await expect(overlay).toHaveClass(/opacity-100/);
    // Scope the link lookups to the sidebar panel: the top <nav> renders the same link
    // texts, so unscoped locators would be strict-mode violations.
    await expect(
      sidebar.getByRole("link", { name: "Dashboard" }),
    ).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Members" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Meetups" })).toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: "Onboarding" }),
    ).toBeVisible();

    // 2. Click 'Members' inside the sidebar
    await sidebar.getByRole("link", { name: "Members" }).click();

    // expect: URL becomes /members
    await expect(page).toHaveURL("/members", { timeout: 15000 });
    // Assert arrival on a stable landmark rather than on member data: other workers
    // create and delete member fixtures concurrently, and the page re-enters its skeleton
    // branch when the SWR key rebuilds on token hydration.
    await expect(
      page.getByRole("textbox", { name: "Search members..." }),
    ).toBeVisible({ timeout: 15000 });

    // expect: The sidebar closes on the route change.
    // This is the behaviour the source produces, not an implementation-agnostic guess:
    // `isSidebarOpen` is local useState inside NavigationBar, and NavigationBar is
    // rendered by DashboardLayout, which each page mounts for itself. Navigating swaps
    // the page component in _app.tsx, so the whole layout subtree -- NavigationBar
    // included -- unmounts and remounts with the sidebar back at its default closed
    // state. The locators below therefore resolve against freshly mounted elements.
    await expect(sidebar).toHaveClass(/-translate-x-full/, { timeout: 15000 });
    await expect(overlay).toHaveClass(/opacity-0 pointer-events-none/);
    // The hamburger shows the Menu icon again (lucide-react renders
    // <svg class="lucide lucide-menu"> for <Menu/> and "lucide-x" for <X/>).
    await expect(hamburgerButton.locator("svg.lucide-menu")).toBeVisible();
  });
});
