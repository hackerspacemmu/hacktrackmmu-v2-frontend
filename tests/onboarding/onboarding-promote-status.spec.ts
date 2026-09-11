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
    // rather than clicked through earlier stages to get there.
    member = await createMember({
      name: uniqueMemberName("Onb Promote", test.info().workerIndex),
      status: "registered",
    });
  });

  test.afterEach(async () => {
    if (member) {
      await cleanUp(`member ${member.id}`, () => deleteMemberById(member!.id));
      member = null;
    }
  });

  test("Promoting onboarding status advances to the next stage", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, go to /onboarding, search for the fixture
    // member (status 'Registered') and open its View modal
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

    // expect: The modal's Status heading reads `Status: Registered`
    await expect(
      modal.getByRole("heading", { name: "Status: Registered" }),
    ).toBeVisible();

    // expect: An enabled (blue) up-arrow Promote button is visible (its title is
    // `Promote to Contacted`). When promotion is not possible this renders as a
    // non-interactive grey <div> instead, so getByRole("button", ...) only matches the
    // enabled, interactive variant.
    const promoteButton = modal.getByRole("button", {
      name: "Promote to Contacted",
    });
    await expect(promoteButton).toBeVisible();

    // 2. Click the promote (up-arrow) button
    // Created before the click so the PUT fired by the click cannot be missed.
    const putResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/v1/members/${member!.id}`) &&
        response.request().method() === "PUT",
    );
    await promoteButton.click();

    // expect: PUT /api/v1/members/<fixture id> fires, and its request body carries the
    // next status `contacted`
    const putResponse = await putResponsePromise;
    expect(putResponse.request().postDataJSON()).toEqual({
      member: { status: "contacted" },
    });

    // expect: Toast `Member status updated successfully` is visible immediately after the
    // click. Toasts auto-dismiss after exactly 5000ms, so this is asserted right after the
    // PUT resolves rather than behind any other wait.
    await expect(
      page.getByText("Member status updated successfully"),
    ).toBeVisible();

    // expect: The Status heading in the modal updates to `Status: Contacted`
    await expect(
      modal.getByRole("heading", { name: "Status: Contacted" }),
    ).toBeVisible();
  });
});
