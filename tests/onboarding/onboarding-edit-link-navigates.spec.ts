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
    // Fixture is created directly at "registered" -- the scenario's starting status --
    // with a distinctive comment so the pre-filled edit form can be checked against known
    // input.
    member = await createMember({
      name: uniqueMemberName("Onb EditLink", test.info().workerIndex),
      status: "registered",
      comment: "E2E onboarding edit-link comment",
    });
  });

  test.afterEach(async () => {
    if (member) {
      await cleanUp(`member ${member.id}`, () => deleteMemberById(member!.id));
      member = null;
    }
  });

  test("Edit link from onboarding row navigates to the member edit page with a source query param", async ({
    page,
  }) => {
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

    // 2. Search for the fixture member, then click 'Edit' on its row (scope to the
    // fixture's row, exact: true)
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
    await page
      .getByRole("textbox", { name: "Search members..." })
      .fill(member!.name);
    await searchResponsePromise;

    // The Status <select> has no accessible name and matches on every row, so the row is
    // scoped by the fixture's unique name first and the Edit button is found within it.
    // `exact: true` avoids the row's comment button (labelled with the comment text, which
    // could otherwise match by substring) colliding with "Edit".
    const memberRow = tableBody.locator("tr").filter({ hasText: member!.name });
    await expect(memberRow).toHaveCount(1, { timeout: 15000 });
    await memberRow.getByRole("button", { name: "Edit", exact: true }).click();

    // expect: Navigates to `/member/<fixture id>/edit?source=onboarding` -- assert the
    // full path INCLUDING the query string
    await expect(page).toHaveURL(
      `/member/${member!.id}/edit?source=onboarding`,
      { timeout: 15000 },
    );

    // expect: The form is pre-filled with the fixture member's Name, Email and Comment
    await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue(
      member!.name,
      { timeout: 15000 },
    );
    await expect(page.getByRole("textbox", { name: "Email" })).toHaveValue(
      member!.email,
    );
    await expect(page.getByRole("textbox", { name: "Comment" })).toHaveValue(
      "E2E onboarding edit-link comment",
    );
  });
});
