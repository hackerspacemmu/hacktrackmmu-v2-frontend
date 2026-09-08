// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Members", () => {
  test("Searching for a non-existent member shows an empty result set", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, go to /members
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Password" }).fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await page.goto("/members");

    // expect: Member cards loaded
    const memberCards = page
      .locator("div.grid > div")
      // Real MemberCards only. SkeletonMemberCard renders the same `div.grid > div` shape
      // with an <h1> whose span holds an empty pulse placeholder, so a heading-based
      // filter matches skeletons too and `.first()` can resolve to one while SWR is still
      // loading. Every real card renders "<n> Projects"; no skeleton does.
      .filter({ hasText: /\d+ Projects/ });
    await expect(memberCards.first()).toBeVisible({ timeout: 15000 });
    const pager = page.locator("div.fixed.bottom-4");
    await expect(pager).toBeVisible({ timeout: 15000 });

    // 2. Type a nonsense query (e.g. 'zzzznonexistentmember') into the search box and wait
    //    for the debounce
    const searchInput = page.getByRole("textbox", { name: "Search members..." });
    await searchInput.fill("zzzznonexistentmember");

    // expect: The member card grid becomes empty (no cards render)
    await expect(memberCards).toHaveCount(0, { timeout: 15000 });

    // expect: No error is thrown/shown
    // ErrorPage renders the heading "An error occured!" (note the source's typo). A short
    // negative assertion is enough since an error state would already be visible by now.
    await expect(
      page.getByRole("heading", { name: "An error occured!" }),
    ).not.toBeVisible({ timeout: 3000 });

    // expect: Clicking the 'x' clear icon restores the full member list
    // The clear icon is a bare lucide <svg> with an onClick handler, not a button, so it
    // has no accessible role/name.
    const clearIcon = page.locator(".search-container svg.lucide-x");
    await expect(clearIcon).toBeVisible({ timeout: 15000 });
    await clearIcon.click();

    await expect(memberCards.first()).toBeVisible({ timeout: 15000 });
    expect(await memberCards.count()).toBeGreaterThan(0);

    // ...and brings the pagination pill back
    await expect(pager).toBeVisible({ timeout: 15000 });
  });
});
