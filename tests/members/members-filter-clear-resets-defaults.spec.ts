// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Members", () => {
  test("Filter popover Clear button resets to default statuses", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, go to /members, open Filter, change Status
    // to something else, and click Filter to apply
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Password" }).fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });

    await page.goto("/members");
    // Gate on real content, since the grid is SWR-backed and renders skeletons first.
    const memberCards = page
      .locator("div.grid > div")
      // Real MemberCards only. SkeletonMemberCard renders the same `div.grid > div` shape
      // with an <h1> whose span holds an empty pulse placeholder, so a heading-based
      // filter matches skeletons too and `.first()` can resolve to one while SWR is still
      // loading. Every real card renders "<n> Projects"; no skeleton does.
      .filter({ hasText: /\d+ Projects/ });
    await expect(memberCards.first()).toBeVisible({ timeout: 15000 });

    const filterTrigger = page.getByRole("button", { name: "Filter" });
    await filterTrigger.click();

    // The selects have no accessible name (FilterComponent/selector.tsx renders a <label>
    // with no htmlFor and a <select> with no id), so scope to the popover and address
    // them positionally: nth(0) is Status, nth(1) is Sort By.
    const popover = page.locator("div.absolute.top-full");
    await expect(popover).toBeVisible({ timeout: 15000 });
    const statusSelect = popover.locator("select").nth(0);
    const sortBySelect = popover.locator("select").nth(1);

    // Verified live that "registered" currently has zero members (same empty-grid
    // situation as "duplicate"), which would not demonstrate a real list update, so
    // "socially_active" (verified live to have rows) is used as the "something else"
    // status. Sort By is also changed to "alphabetical" so the later Clear reset is
    // observable.
    await statusSelect.selectOption("socially_active");
    await sortBySelect.selectOption("alphabetical");
    // The trigger button and the popover's apply button share the accessible name
    // "Filter", so scope the apply button to the popover to avoid strict-mode ambiguity.
    await popover.getByRole("button", { name: "Filter" }).click();

    // expect: List updates to the new filter
    const statusChips = page.locator("div.currentStatusMap");
    await expect(
      statusChips.getByText("Socially Active", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(memberCards.first()).toBeVisible({ timeout: 15000 });

    // 2. Reopen the Filter popover and click 'Clear'
    await filterTrigger.click();
    await expect(popover).toBeVisible({ timeout: 15000 });
    await popover.getByRole("button", { name: "Clear" }).click();

    // expect: Popover closes and the member list reflects the default filter
    await expect(popover).not.toBeVisible({ timeout: 15000 });
    await expect(
      statusChips.getByText("Active", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      statusChips.getByText("Socially Active", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(memberCards.first()).toBeVisible({ timeout: 15000 });

    // expect: The applied filter reverts to the default statuses (Active, Socially Active)
    // expect: Sort resets to its default
    // The plan text is inaccurate on both points; verified live by reopening the popover
    // after Clear:
    // - Status: FilterComponent's handleClear sets its local state to "all" but then
    //   calls onStatusChange(defaultStatuses), which re-renders the parent with
    //   currentStatus="active", and a useEffect syncs the select back to "active" -- so
    //   the popover shows Status = "Active", NOT an "All" selection as the plan claims.
    // - Sort: memberFilter.tsx defines DEFAULT_SORT = "newest" and members.tsx never
    //   passes a defaultSort prop, so Clear resets Sort By to "Newest", NOT "Recent Talks"
    //   as the plan claims.
    await filterTrigger.click();
    await expect(popover).toBeVisible({ timeout: 15000 });
    await expect(statusSelect).toHaveValue("active", { timeout: 15000 });
    await expect(sortBySelect).toHaveValue("newest", { timeout: 15000 });
  });
});
