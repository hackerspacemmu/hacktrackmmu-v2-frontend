// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";
import {
  cleanUp,
  createMember,
  deleteMemberById,
  uniqueMemberName,
  type MemberFixture,
} from "../support/api";

test.describe("Onboarding", () => {
  let member: MemberFixture | null = null;

  test.beforeEach(async () => {
    member = await createMember({
      name: uniqueMemberName("Onb Search", test.info().workerIndex),
      status: "registered",
    });
  });

  test.afterEach(async () => {
    if (member) {
      await cleanUp(`member ${member.id}`, () => deleteMemberById(member!.id));
      member = null;
    }
  });

  test("Searching the onboarding list filters by name", async ({ page }) => {
    // 1. Navigate to /login, log in as admin, go to /onboarding
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Password" }).fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await page.goto("/onboarding");

    // expect: Rows loaded
    // The tbody renders a single placeholder <tr> reading "Loading..." (and later
    // "No members found") when there is no data, so waiting on `tr` alone would be
    // satisfied by that placeholder. Only a real member row carries a View button, so
    // key the "loaded" check off that instead.
    const table = page.locator("table");
    const tableBody = table.locator("tbody");
    const dataRows = tableBody
      .locator("tr")
      .filter({ has: page.getByRole("button", { name: "View", exact: true }) });
    await expect(dataRows.first()).toBeVisible({ timeout: 15000 });

    // 2. Type the fixture member's tagged name into the Search members box and wait for
    //    the debounce
    // The waitForResponse promise is created BEFORE typing so it cannot miss the request
    // that fires ~300ms after the last keystroke. The Rails API is on http://localhost:3000,
    // a different origin from baseURL, so the URL is matched by substring rather than a
    // baseURL-rooted glob.
    const searchResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/members/search") &&
        response.request().method() === "GET",
      { timeout: 15000 },
    );
    const searchInput = page.getByRole("textbox", { name: "Search members..." });
    await searchInput.fill(member!.name);

    // expect: GET /api/v1/members/search fires
    await searchResponsePromise;

    // expect: Exactly one data row remains and its Name cell holds the fixture member's name
    const remainingRows = tableBody.locator("tr");
    await expect(remainingRows).toHaveCount(1, { timeout: 15000 });
    await expect(remainingRows.first().locator("td").first()).toHaveText(
      member!.name,
    );

    // expect: The pagination control is hidden while searching
    // The bottom-right pagination control renders as a fixed bottom-right container that
    // is omitted entirely (not just hidden) while isSearching is true.
    const pager = page.locator("div.fixed.bottom-4");
    await expect(pager).not.toBeVisible({ timeout: 3000 });
  });
});
