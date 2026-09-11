// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Members", () => {
  test("Filter popover changes the status filter and refetches", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, go to /members, click 'Filter'
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Password" }).fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });

    await page.goto("/members");
    // Gate on real content (the grid is SWR-backed and renders skeletons first) before
    // interacting with the filter.
    const memberCards = page
      .locator("div.grid > div")
      // Real MemberCards only. SkeletonMemberCard renders the same `div.grid > div` shape
      // with an <h1> whose span holds an empty pulse placeholder, so a heading-based
      // filter matches skeletons too and `.first()` can resolve to one while SWR is still
      // loading. Every real card renders "<n> Projects"; no skeleton does.
      .filter({ hasText: /\d+ Projects/ });
    await expect(memberCards.first()).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: "Filter" }).click();

    // expect: Popover opens with a Status select (defaulting to 'Active') and a Sort By
    // select (defaulting to 'Recent Talks')
    // The selects have no accessible name (FilterComponent/selector.tsx renders a <label>
    // with no htmlFor and a <select> with no id), so scope to the popover and address
    // them positionally: nth(0) is Status, nth(1) is Sort By.
    const popover = page.locator("div.absolute.top-full");
    await expect(popover).toBeVisible({ timeout: 15000 });
    const statusSelect = popover.locator("select").nth(0);
    const sortBySelect = popover.locator("select").nth(1);
    // Verified live: members.tsx initialises sortBy to "recent_talks" and the default
    // status filter is "active", so assert the real underlying option values.
    await expect(statusSelect).toHaveValue("active", { timeout: 15000 });
    await expect(sortBySelect).toHaveValue("recent_talks", { timeout: 15000 });

    // 2. Change Status to 'Duplicate' and click the 'Filter' button inside the popover
    await statusSelect.selectOption("duplicate");
    const filteredResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/members/filtered") &&
        response.request().method() === "GET",
      { timeout: 15000 },
    );
    // The trigger button and the popover's apply button share the accessible name
    // "Filter", so scope the apply button to the popover to avoid strict-mode ambiguity.
    await popover.getByRole("button", { name: "Filter" }).click();

    // expect: GET /api/v1/members/filtered?...status[]=duplicate... fires
    // Verified live that the browser encodes the query as "status%5B%5D=duplicate" and
    // that the page param resets to 1.
    const filteredResponse = await filteredResponsePromise;
    expect(filteredResponse.url()).toContain("status%5B%5D=duplicate");
    expect(filteredResponse.url()).toContain("page=1");

    // expect: Popover closes
    await expect(popover).not.toBeVisible({ timeout: 15000 });

    // expect: Displayed status chip(s) update to reflect the new filter
    // There are currently zero members with status "duplicate", so the grid legitimately
    // becomes EMPTY. That is expected, not a failure.
    const statusChips = page.locator("div.currentStatusMap");
    await expect(
      statusChips.getByText("Duplicate", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(memberCards).toHaveCount(0, { timeout: 15000 });

    // expect: Pagination resets to page 1
    const pager = page.locator("div.fixed.bottom-4");
    const paginationLabel = pager.locator("div", { hasText: /^\d+ - \d+$/ });
    await expect(paginationLabel).toHaveText(/^1 - \d+$/, { timeout: 15000 });
  });
});
