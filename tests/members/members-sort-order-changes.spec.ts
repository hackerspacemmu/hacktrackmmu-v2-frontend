// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";
import { captureTexts } from "../support/ui";

test.describe("Members", () => {
  test("Sort By option changes member ordering", async ({ page }) => {
    // 1. Navigate to /login, log in as admin, go to /members, note the name of the first card
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
    // Each card heading renders the member's name in a leading <div>, followed by a
    // second <div> holding the status label, so scope to the first child to read names.
    const cardNameLocator = page.locator("div.grid > div h1 > div:first-child");
    const namesBeforeSort = await captureTexts(cardNameLocator);

    // expect: Default sort is 'Recent Talks'
    await page.getByRole("button", { name: "Filter" }).click();
    const popover = page.locator("div.absolute.top-full");
    await expect(popover).toBeVisible({ timeout: 15000 });
    // The selects have no accessible name (FilterComponent/selector.tsx renders a <label>
    // with no htmlFor and a <select> with no id), so scope to the popover and address
    // them positionally: nth(0) is Status, nth(1) is Sort By.
    const sortBySelect = popover.locator("select").nth(1);
    await expect(sortBySelect).toHaveValue("recent_talks", { timeout: 15000 });

    // 2. Open Filter, change Sort By to 'Alphabetical', click Filter
    await sortBySelect.selectOption("alphabetical");
    const filteredResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/members/filtered") &&
        response.request().method() === "GET",
      { timeout: 15000 },
    );
    // The trigger button and the popover's apply button share the accessible name
    // "Filter", so scope the apply button to the popover to avoid strict-mode ambiguity.
    await popover.getByRole("button", { name: "Filter" }).click();

    // expect: GET request includes sort_by=alphabetical
    const filteredResponse = await filteredResponsePromise;
    expect(filteredResponse.url()).toContain("sort_by=alphabetical");

    // expect: The ordering of the rendered cards reflects alphabetical ordering
    // Verified live that the second card becomes "Ahmad Mobeen Mohammad Azeem" once the
    // re-sorted grid has rendered; wait for it so the read below isn't racing the update.
    await expect(cardNameLocator.nth(1)).toHaveText(
      "Ahmad Mobeen Mohammad Azeem",
      { timeout: 15000 },
    );
    const namesAfterSort = await captureTexts(cardNameLocator);

    // Verified against the API: both recent_talks and alphabetical currently return
    // "Abdullah Hakeem bin Ahmad Kamal" as the first result, so asserting "the first
    // card changed" (as originally worded in the plan) would fail here. Instead assert
    // the real, stable properties of the new ordering: the list is alphabetically
    // ascending, and the overall sequence differs from the pre-sort sequence even
    // though the first element happens to coincide.
    const alphabeticallySorted = [...namesAfterSort].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
    expect(namesAfterSort).toEqual(alphabeticallySorted);
    expect(namesAfterSort).not.toEqual(namesBeforeSort);
  });
});
