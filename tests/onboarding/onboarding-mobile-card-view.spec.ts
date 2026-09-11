// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Onboarding", () => {
  test("Onboarding switches to a mobile card list under 768px", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, resize the viewport to 375x812, then
    //    navigate to /onboarding.
    // No browser-resize tool was available while recording this test live, so the
    // viewport resize and every mobile-only assertion below were written directly from
    // src/components/Onboarding/OnboardingMobileCard/index.tsx and
    // src/components/NavigationBar/index.tsx rather than verified against a live run —
    // this test still needs to be executed once to confirm the selectors hold.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Password" }).fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await page.goto("/onboarding");

    // expect: The desktop <table> is NOT present; a stacked card list renders instead,
    // each card showing the member name, a "Contact:" line, a "Created:" line, an inline
    // status <select>, and View/Edit/Delete buttons
    await expect(page.locator("table")).toHaveCount(0);
    // OnboardingMobileCard renders one `div.border.border-gray-700...rounded-lg.p-4.mb-4`
    // per member (per source); scope assertions to the first card so a match can't come
    // from an unrelated element elsewhere on the page.
    const firstCard = page.locator("div.rounded-lg.p-4.mb-4").first();
    await expect(firstCard).toBeVisible({ timeout: 15000 });
    await expect(firstCard.getByRole("heading", { level: 2 })).toBeVisible();
    await expect(firstCard.getByText("Contact:")).toBeVisible();
    await expect(firstCard.getByText("Created:")).toBeVisible();
    // The status <select> has no accessible name/label, so target it by tag scoped to
    // the card rather than by role.
    await expect(firstCard.locator("select")).toBeVisible();
    await expect(firstCard.getByRole("button", { name: "View", exact: true })).toBeVisible();
    await expect(firstCard.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    await expect(firstCard.getByRole("button", { name: "Delete", exact: true })).toBeVisible();

    // expect: A hamburger menu button is present in place of the full desktop nav links
    // (the desktop links are inside a `hidden lg:flex` container; the hamburger is inside
    // `block lg:hidden`)
    // Tailwind's `hidden` class sets a real `display: none` below the `lg` breakpoint, so
    // Playwright's visibility check reflects the actual responsive layout switch rather
    // than an off-screen transform.
    const desktopNavLinks = page.locator("div.hidden.lg\\:flex").first();
    await expect(desktopNavLinks).toBeHidden();
    const mobileNavContainer = page.locator("div.block.lg\\:hidden");
    await expect(mobileNavContainer).toBeVisible();
    await expect(mobileNavContainer.getByRole("button")).toBeVisible();
  });
});
