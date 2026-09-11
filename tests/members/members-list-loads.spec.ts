// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Members", () => {
  test("Members list loads with cards and pagination controls", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, click 'Members' in the nav
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Password" }).fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    // Scope to the top nav bar rather than `.first()` on the link itself. The slide-in
    // Sidebar is a SIBLING of this <nav> and renders the same links, and its Onboarding
    // link is gated on `isAdmin` alone while the desktop one needs `isClient && isAdmin`
    // -- so during the hydration window the sidebar's copy is the FIRST match in the DOM.
    // The closed sidebar is translated off-screen (-translate-x-full), which Playwright
    // still reports as visible, so `.first().click()` times out with "element is outside
    // of the viewport" rather than failing fast.
    const desktopNav = page.getByRole("navigation").first();
    await desktopNav.getByRole("link", { name: "Members" }).click();

    // expect: URL is /members
    await expect(page).toHaveURL("/members", { timeout: 15000 });

    // expect: Skeleton member cards appear briefly then resolve to real member cards
    // SkeletonMemberCard renders 8x while the /members/filtered SWR request is in
    // flight, but it resolves too fast in practice to reliably catch a skeleton frame
    // without artificially delaying the network request. Instead we gate on the
    // deterministic resolved state: real, clickable member cards with a heading.
    const memberCards = page
      .locator("div.grid > div")
      // Real MemberCards only. SkeletonMemberCard renders the same `div.grid > div` shape
      // with an <h1> whose span holds an empty pulse placeholder, so a heading-based
      // filter matches skeletons too and `.first()` can resolve to one while SWR is still
      // loading. Every real card renders "<n> Projects"; no skeleton does.
      .filter({ hasText: /\d+ Projects/ });
    await expect(memberCards.first()).toBeVisible({ timeout: 15000 });
    // A retrying count assertion, NOT `expect(await cards.count())`. /members rebuilds its
    // SWR key whenever `token`, the page, the filter or the sort changes (and `token`
    // starts empty until the auth store hydrates), so `isLoading` goes true again and the
    // skeleton grid re-renders AFTER real cards were already shown. An imperative count()
    // can land in that window and read 0; `not.toHaveCount(0)` retries until it does not.
    await expect(memberCards).not.toHaveCount(0, { timeout: 15000 });

    // expect: Default status chips 'Active' and 'Socially Active' are shown next to the heading
    const statusChips = page.locator("div.currentStatusMap");
    await expect(
      statusChips.getByText("Active", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      statusChips.getByText("Socially Active", { exact: true }),
    ).toBeVisible({ timeout: 15000 });

    // expect: A pagination control shows '1 - N' with a disabled previous button on page 1
    // The label text is data-dependent (total_pages depends on DB contents), so assert
    // the "N - M" shape and that it starts at page 1 rather than hardcoding the total.
    const pager = page.locator("div.fixed.bottom-4");
    const paginationLabel = pager.locator("div", { hasText: /^\d+ - \d+$/ });
    await expect(paginationLabel).toHaveText(/^1 - \d+$/, { timeout: 15000 });
    // The prev/next buttons have no accessible name, so address them positionally
    // inside the pill container.
    const prevButton = pager.getByRole("button").first();
    const nextButton = pager.getByRole("button").last();
    await expect(prevButton).toBeDisabled({ timeout: 15000 });
    // The next button is enabled because there is more than one page (the default
    // Active + Socially Active filter yields 3 pages today). It is ALSO disabled while
    // isLoading -- `disabled={isLoading || paginationNumber === totalPagination}` -- so a
    // skeleton re-render can briefly disable it; the timeout has to cover that, not 3s.
    await expect(nextButton).not.toBeDisabled({ timeout: 15000 });
  });
});
