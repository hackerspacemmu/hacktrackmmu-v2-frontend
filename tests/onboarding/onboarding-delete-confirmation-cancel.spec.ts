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
    // Fixture is created directly at "registered" -- the scenario's starting status.
    member = await createMember({
      name: uniqueMemberName("Onb Delete", test.info().workerIndex),
      status: "registered",
    });
  });

  test.afterEach(async () => {
    if (member) {
      // deleteMemberById already treats a 404 as success, so this teardown tolerates the
      // record being gone -- though the cancel path under test means it never should be.
      await cleanUp(`member ${member.id}`, () => deleteMemberById(member!.id));
      member = null;
    }
  });

  test("Delete confirmation modal can be cancelled without deleting a seeded onboarding member", async ({
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

    // Registered BEFORE step 2 (the click that opens the confirmation modal) so it cannot
    // miss a DELETE request fired at any point during the rest of the test. This is a
    // negative assertion, not a bare timeout -- the request is checked for at the end.
    const deleteRequests: string[] = [];
    page.on("request", (request) => {
      if (
        request.url().includes(`/api/v1/members/${member!.id}`) &&
        request.method() === "DELETE"
      ) {
        deleteRequests.push(request.url());
      }
    });

    // 2. Search for the fixture member, then click 'Delete' on its row (scope to the
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
    // scoped by the fixture's unique name first and the row's own Delete button is found
    // within it -- this is the ROW's Delete button, distinct from the confirmation modal's
    // own Delete button asserted below. `exact: true` avoids the row's comment button
    // (labelled "Add comment...") matching by substring.
    const memberRow = tableBody.locator("tr").filter({ hasText: member!.name });
    await expect(memberRow).toHaveCount(1, { timeout: 15000 });
    await memberRow.getByRole("button", { name: "Delete", exact: true }).click();

    // The modal is rendered through a React portal at the document body, outside the
    // table, so it is scoped by its own container rather than by role (ModalLayout has no
    // dialog role). This also avoids colliding with the row's own Delete button, which
    // stays mounted behind the modal.
    const modal = page.locator("div.fixed.inset-0.z-50");

    // expect: A modal titled `Delete Member` appears containing the warning text
    // `Doing so cannot be reversed!` plus Cancel and Delete buttons
    await expect(
      modal.getByRole("heading", { name: "Delete Member" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(modal.getByText("Doing so cannot be reversed!")).toBeVisible();
    const cancelButton = modal.getByRole("button", { name: "Cancel" });
    // This is the modal's OWN confirming Delete button, distinct from the row's Delete
    // button that opened the modal.
    const confirmDeleteButton = modal.getByRole("button", {
      name: "Delete",
      exact: true,
    });
    await expect(cancelButton).toBeVisible();
    await expect(confirmDeleteButton).toBeVisible();

    // 3. Click 'Cancel'
    await cancelButton.click();

    // expect: The modal closes
    await expect(modal).toBeHidden({ timeout: 15000 });

    // expect: No DELETE /api/v1/members/<fixture id> request fires at any point during the
    // test
    expect(deleteRequests).toEqual([]);

    // expect: The fixture member's row still appears in the table
    await expect(memberRow).toHaveCount(1, { timeout: 15000 });
  });
});
