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

test.describe("Members", () => {
  let member: MemberFixture | null = null;

  test.beforeEach(async () => {
    member = await createMember({
      name: uniqueMemberName("Search Target", test.info().workerIndex),
      status: "active",
    });
  });

  test.afterEach(async () => {
    if (member) {
      await cleanUp(`member ${member.id}`, () => deleteMemberById(member!.id));
      member = null;
    }
  });

  test("Searching for an existing member returns matching results", async ({
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

    // 2. Type the fixture member's tagged name into the Search members input and wait
    //    ~500ms for the debounce
    // The waitForResponse promise is created BEFORE typing so it cannot miss the request
    // that fires ~300ms after the last keystroke. The API is on http://localhost:3000, a
    // different origin from baseURL, so the URL is matched by substring rather than a
    // baseURL-rooted glob.
    const searchResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/v1/members/search"),
      { timeout: 15000 },
    );
    const searchInput = page.getByRole("textbox", { name: "Search members..." });
    await searchInput.fill(member!.name);

    // expect: GET /api/v1/members/search?query=... fires
    await searchResponsePromise;

    // expect: The grid now shows only matching card(s) for that name
    // Fixture members have no talks/projects and would not otherwise reliably appear on
    // page 1 of the default list, so the search result is the only reliable way to reach it.
    await expect(memberCards).toHaveCount(1, { timeout: 15000 });
    await expect(
      memberCards.getByRole("heading", { name: member!.name }),
    ).toBeVisible({ timeout: 15000 });

    // expect: The bottom pagination control is hidden while searching
    const pager = page.locator("div.fixed.bottom-4");
    await expect(pager).not.toBeVisible({ timeout: 3000 });
  });
});
