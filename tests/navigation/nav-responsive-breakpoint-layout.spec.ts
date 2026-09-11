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

test.describe("Navigation & Layout", () => {
  let member: MemberFixture | null = null;

  // The scenario itself mutates nothing, but it still owns its data rather than reading
  // whatever happens to sit on page 1 of /onboarding: with fullyParallel: true another
  // worker's fixture can appear or vanish mid-test, and "the table/card list is
  // non-empty" is not a guarantee any shared record provides. Searching for a member this
  // test created makes both layout branches assert on a row that is certain to be there.
  test.beforeEach(async () => {
    member = await createMember({
      name: uniqueMemberName("Nav Responsive", test.info().workerIndex),
      status: "registered",
    });
  });

  test.afterEach(async () => {
    if (member) {
      await cleanUp(`member ${member.id}`, () => deleteMemberById(member!.id));
      member = null;
    }
  });

  test("Responsive layout switches from grid/table to stacked cards at the mobile breakpoint", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, go to /onboarding at a desktop width (1280px)
    // The width is set explicitly rather than relying on the project's default viewport,
    // so the resize back in step 3 returns to a known desktop size.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/login");
    await page
      .getByRole("textbox", { name: "Password" })
      .fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await page.goto("/onboarding");

    // The tbody renders a placeholder <tr> ("Loading..." / "No members found") when there
    // is no data, so waiting on `tr` alone would be satisfied by that placeholder. Only a
    // real member row carries a View button, so key the "loaded" check off that.
    const table = page.locator("table");
    const dataRows = table
      .locator("tbody tr")
      .filter({ has: page.getByRole("button", { name: "View", exact: true }) });
    await expect(dataRows.first()).toBeVisible({ timeout: 15000 });

    // Narrow the page down to the fixture with the search box. The waitForResponse
    // promise is created BEFORE typing so it cannot miss the request that fires ~300ms
    // after the last keystroke; the Rails API is on a different origin from baseURL, so
    // the URL is matched by substring rather than a baseURL-rooted glob.
    const searchResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/members/search") &&
        response.request().method() === "GET",
      { timeout: 15000 },
    );
    await page
      .getByRole("textbox", { name: "Search members..." })
      .fill(member!.name);
    await searchResponsePromise;

    // expect: A <table> element renders the onboarding rows
    const fixtureRow = table
      .locator("tbody tr")
      .filter({ hasText: member!.name });
    await expect(table).toBeVisible();
    await expect(fixtureRow).toHaveCount(1, { timeout: 15000 });

    // 2. Resize the viewport down to 375px width without navigating away
    await page.setViewportSize({ width: 375, height: 812 });

    // expect: Table is replaced by the stacked OnboardingMobileCard list (breakpoint is
    // max-width: 768px per the useMediaQuery hook)
    // The two branches are mutually exclusive in onboarding.tsx (`!isMaxWidth768px ?
    // <table> : cards`), so the table is unmounted outright rather than hidden -- assert
    // its absence with a count, which retries, rather than toBeHidden() on a detached
    // element.
    await expect(table).toHaveCount(0, { timeout: 15000 });
    // OnboardingMobileCard's outer container is
    // `border border-gray-700 bg-[#1e1e1e]/30 rounded-lg p-4 mb-4`; scope to the card
    // holding the fixture's name so the match cannot come from another card or an
    // unrelated rounded container.
    const fixtureCard = page
      .locator("div.rounded-lg.p-4.mb-4")
      .filter({ hasText: member!.name });
    await expect(fixtureCard).toHaveCount(1, { timeout: 15000 });
    await expect(fixtureCard).toBeVisible();
    // The card carries the same per-member controls the table row did, which is what
    // makes it a replacement for the row rather than a different, reduced view.
    await expect(
      fixtureCard.getByRole("button", { name: "View", exact: true }),
    ).toBeVisible();
    await expect(
      fixtureCard.getByRole("button", { name: "Delete", exact: true }),
    ).toBeVisible();

    // 3. Resize back up to 1280px
    await page.setViewportSize({ width: 1280, height: 800 });

    // expect: Table view returns
    await expect(table).toBeVisible({ timeout: 15000 });
    await expect(fixtureRow).toHaveCount(1, { timeout: 15000 });
    await expect(page.locator("div.rounded-lg.p-4.mb-4")).toHaveCount(0);
  });
});
