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
    // Fixture is created directly at "first_talk_given" -- the final onboarding stage --
    // rather than clicked through earlier stages to get there.
    member = await createMember({
      name: uniqueMemberName("Onb Final", test.info().workerIndex),
      status: "first_talk_given",
    });
  });

  test.afterEach(async () => {
    if (member) {
      await cleanUp(`member ${member.id}`, () => deleteMemberById(member!.id));
      member = null;
    }
  });

  test("Member at final onboarding status shows the 'assign in edit page' tick instead of a promote arrow", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, go to /onboarding, search for the fixture
    // member (status 'First Talk Given') and open its View modal
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Password" }).fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await page.goto("/onboarding");

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
    const memberRow = tableBody.locator("tr").filter({ hasText: member!.name });
    await expect(memberRow).toHaveCount(1, { timeout: 15000 });
    await memberRow.getByRole("button", { name: "View", exact: true }).click();

    // The modal is rendered through a React portal at the document body, outside the
    // table, so it is scoped by its own container rather than by role (ModalLayout has no
    // dialog role).
    const modal = page.locator("div.fixed.inset-0.z-50");
    await expect(
      modal.getByRole("heading", { name: member!.name, level: 2 }),
    ).toBeVisible({ timeout: 15000 });

    // expect: The modal's Status heading reads `Status: First Talk Given`
    await expect(
      modal.getByRole("heading", { name: "Status: First Talk Given" }),
    ).toBeVisible();

    // expect: A green checkmark button titled `Assign Status in Edit Page` is shown,
    // wrapped in a link whose href is `/member/<fixture id>/edit?source=onboarding`
    const assignLink = modal.locator(
      `a[href="/member/${member!.id}/edit?source=onboarding"]`,
    );
    const assignButton = assignLink.getByRole("button", {
      name: "Assign Status in Edit Page",
    });
    await expect(assignButton).toBeVisible();

    // expect: No promote button exists in the modal (assert the count of buttons whose
    // title starts with "Promote to" is 0), since there is no further onboarding stage.
    // At the final onboarding stage the promote control renders as a non-interactive grey
    // <div> wrapping the ArrowUp icon rather than a <button>, so "disabled" is asserted as
    // "no promote button exists" rather than as a button carrying a disabled attribute.
    await expect(modal.locator('button[title^="Promote to"]')).toHaveCount(0);

    // expect: A banner reads `Select Tick Icon to Assign Status in Edit Page.`
    await expect(
      modal.getByText("Select Tick Icon to Assign Status in Edit Page."),
    ).toBeVisible();

    // 2. Click the checkmark
    await assignButton.click();

    // expect: Navigates to `/member/<fixture id>/edit?source=onboarding` -- assert the
    // full path INCLUDING the query string
    await expect(page).toHaveURL(
      `/member/${member!.id}/edit?source=onboarding`,
      { timeout: 15000 },
    );

    // expect: The edit form is pre-filled with the fixture member's name
    await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue(
      member!.name,
      { timeout: 15000 },
    );
  });
});
