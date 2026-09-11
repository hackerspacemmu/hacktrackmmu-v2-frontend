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
      name: uniqueMemberName("Onb View", test.info().workerIndex),
      status: "registered",
      // Populated so the modal's real values can be asserted against known input.
      contact_number: "0123456789",
      comment: "E2E onboarding view comment",
      student_id: "1211100123",
      discord_tag: "onbview",
      // faculty/why_join are populated; every other other_info field is left blank on
      // purpose so the modal's "Not Provided" fallbacks can be asserted too.
      other_info: { faculty: "FCI", why_join: "To build things" },
    });
  });

  test.afterEach(async () => {
    if (member) {
      await cleanUp(`member ${member.id}`, () => deleteMemberById(member!.id));
      member = null;
    }
  });

  test("Clicking View opens the onboarding member detail modal", async ({
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

    // 2. Search for the fixture member, then click 'View' on its row
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
    // scoped by the fixture's unique name first and the View button is found within it.
    // `exact: true` is required: getByRole name matching is a case-insensitive SUBSTRING
    // match, and the row's comment button is labelled with the comment itself
    // ("E2E onboarding view comment"), which contains "view" -- without it the locator
    // resolves to two buttons and fails strict mode.
    const memberRow = tableBody.locator("tr").filter({ hasText: member!.name });
    await expect(memberRow).toHaveCount(1, { timeout: 15000 });
    await memberRow.getByRole("button", { name: "View", exact: true }).click();

    // The modal is rendered through a React portal at the document body, outside the
    // table, so it is scoped by its own container rather than by role (ModalLayout has no
    // dialog role). This also avoids colliding with the row's own "<comment>" button,
    // which repeats the same text as the modal's Comment section while the row stays
    // mounted behind the modal.
    const modal = page.locator("div.fixed.inset-0.z-50");

    // expect: A modal opens with the member's name as its heading
    await expect(
      modal.getByRole("heading", { name: member!.name, level: 2 }),
    ).toBeVisible({ timeout: 15000 });

    // expect: The Status heading reads `Status: Registered`
    await expect(
      modal.getByRole("heading", { name: "Status: Registered" }),
    ).toBeVisible();

    // expect: A "Contact Information" section shows the fixture's email, contact number,
    // and discord tag
    await expect(
      modal.getByRole("heading", { name: "Contact Information" }),
    ).toBeVisible();
    await expect(modal.getByText(`Email: ${member!.email}`)).toBeVisible();
    await expect(modal.getByText("Contact Number: 0123456789")).toBeVisible();
    await expect(modal.getByText("Discord Tag: onbview")).toBeVisible();

    // expect: The "Comment" section shows the fixture's comment
    await expect(modal.getByRole("heading", { name: "Comment" })).toBeVisible();
    await expect(
      modal.getByText("E2E onboarding view comment"),
    ).toBeVisible();

    // expect: An "Other Information" section shows Register Date and Register Time,
    // Student ID, and Faculty
    await expect(
      modal.getByRole("heading", { name: "Other Information" }),
    ).toBeVisible();
    await expect(modal.getByText(/^Register Date:/)).toBeVisible();
    await expect(modal.getByText(/^Register Time:/)).toBeVisible();
    await expect(modal.getByText("Student ID: 1211100123")).toBeVisible();
    await expect(modal.getByText("Faculty: FCI")).toBeVisible();

    // expect: Fields left blank each fall back to a "Not Provided" indicator
    // (NullTextIndicator, per src/components/atomComponents/NullTextIndicator.tsx)
    await expect(
      modal.getByText("Affiliation with MMU: Not Provided"),
    ).toBeVisible();
    await expect(
      modal.getByText("Year Joined MMU: Not Provided"),
    ).toBeVisible();
    await expect(
      modal.getByText("Instagram Handle: Not Provided"),
    ).toBeVisible();
  });
});
