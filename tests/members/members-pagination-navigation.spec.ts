// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Members", () => {
  test("Pagination next/previous buttons navigate between pages", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, go to /members
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Password" }).fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });

    await page.goto("/members");
    // Gate on real content (the grid is SWR-backed and renders skeletons first) before
    // interacting with pagination.
    const memberCards = page
      .locator("div.grid > div")
      // Real MemberCards only. SkeletonMemberCard renders the same `div.grid > div` shape
      // with an <h1> whose span holds an empty pulse placeholder, so a heading-based
      // filter matches skeletons too and `.first()` can resolve to one while SWR is still
      // loading. Every real card renders "<n> Projects"; no skeleton does.
      .filter({ hasText: /\d+ Projects/ });
    await expect(memberCards.first()).toBeVisible({ timeout: 15000 });
    const cardNameLocator = page.locator("div.grid > div h1 > div:first-child");

    // expect: Pagination shows page 1 of N (N > 1) with previous button disabled
    // The pill's buttons have no accessible name, so address them positionally. The
    // label text is data-dependent, so assert the "N - M" shape and page number rather
    // than hardcoding the total page count.
    const pager = page.locator("div.fixed.bottom-4");
    const paginationLabel = pager.locator("div", { hasText: /^\d+ - \d+$/ });
    await expect(paginationLabel).toHaveText(/^1 - \d+$/, { timeout: 15000 });
    const prevButton = pager.getByRole("button").first();
    const nextButton = pager.getByRole("button").last();
    await expect(prevButton).toBeDisabled({ timeout: 15000 });
    // Both buttons are also disabled while isLoading, so this confirms the grid has
    // settled (N > 1 holds today: default Active + Socially Active yields 3 pages).
    await expect(nextButton).not.toBeDisabled({ timeout: 3000 });
    const page1Names = await cardNameLocator.allTextContents();

    // 2. Click the next-page (chevron right) button
    const page2ResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/members/filtered") &&
        response.url().includes("page=2") &&
        response.request().method() === "GET",
      { timeout: 15000 },
    );
    await nextButton.click();

    // expect: GET /api/v1/members/filtered?page=2... fires
    await page2ResponsePromise;

    // expect: Previous button becomes enabled
    await expect(prevButton).not.toBeDisabled({ timeout: 15000 });
    await expect(paginationLabel).toHaveText(/^2 - \d+$/, { timeout: 15000 });

    // expect: The card grid updates to a different set of members
    // Verified live that page 2's first card is "Ganessa A/L Tiagrajah"; wait for it so
    // the read below isn't racing the SWR re-render.
    await expect(cardNameLocator.first()).toHaveText(
      "Ganessa A/L Tiagrajah",
      { timeout: 15000 },
    );
    const page2Names = await cardNameLocator.allTextContents();
    expect(page2Names).not.toEqual(page1Names);

    // 3. Click the previous-page button
    await prevButton.click();

    // expect: Returns to page 1's member set
    await expect(paginationLabel).toHaveText(/^1 - \d+$/, { timeout: 15000 });
    await expect(cardNameLocator.first()).toHaveText(
      "Abdullah Hakeem bin Ahmad Kamal",
      { timeout: 15000 },
    );
    const page1NamesAgain = await cardNameLocator.allTextContents();
    expect(page1NamesAgain).toEqual(page1Names);

    // expect: Previous button disabled again
    await expect(prevButton).toBeDisabled({ timeout: 15000 });
  });
});
