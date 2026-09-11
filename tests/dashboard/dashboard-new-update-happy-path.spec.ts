// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";
import { cleanUp, deleteUpdateByDescription } from "../support/api";

test.describe("Dashboard", () => {
  // This spec creates a real update against a seeded meetup/project/member. The update is
  // deleted directly rather than via a cascade, because the meetup it attaches to is
  // pre-existing seed data that must survive.
  let createdUpdateDescription: string | null = null;

  test.afterEach(async () => {
    if (createdUpdateDescription) {
      await cleanUp(`update "${createdUpdateDescription}"`, () =>
        deleteUpdateByDescription(createdUpdateDescription as string),
      );
      createdUpdateDescription = null;
    }
  });

  test("New Update modal happy path creates an update", async ({ page }) => {
    // 1. Navigate to /login, log in as admin, open 'New Update' modal
    await page.goto("/login");
    const passwordInput = page.getByRole("textbox", { name: "Password" });
    await passwordInput.fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await expect(
      page.getByRole("heading", { name: "Control Panel" }),
    ).toBeVisible({ timeout: 15000 });
    // The "Control Panel" heading alone is NOT proof the dashboard finished loading:
    // dashboard.tsx renders that same heading over three SkeletonActionButtons while
    // the meetups SWR call is still in flight. Gate on a real action button instead.
    await expect(page.getByRole("button", { name: "New Meetup" })).toBeVisible({
      timeout: 30000,
    });

    await page.getByRole("button", { name: "New Update" }).click();

    // expect: Modal open
    await expect(page.getByRole("heading", { name: "New Update" })).toBeVisible(
      {
        timeout: 15000,
      },
    );

    // 2. Select a Member, then select a Project from that member's populated project
    //    list, select a Date, type a Description, and click Submit
    const memberCombobox = page.getByRole("combobox", { name: "Member" });
    const projectCombobox = page.getByRole("combobox", { name: "Project" });
    const dateCombobox = page.getByRole("combobox", { name: "Date" });

    // The Project dropdown is populated from the selected member's nested projects, so
    // this must be a member who actually has some.
    await memberCombobox.click();
    await memberCombobox.fill("Aarief");
    const memberOption = page
      .locator("#member-options")
      .getByRole("option")
      .first();
    await expect(memberOption).toBeVisible({ timeout: 15000 });
    await memberOption.click();
    // SearchableDropdown (single-select) closes itself on select.
    await expect(page.locator("#member-options")).toHaveCount(0, {
      timeout: 15000,
    });

    // A specific long-lived seeded project is chosen rather than simply the first option.
    // The New Project happy-path spec attaches its throwaway "QA Test Project ..." to this
    // same alphabetically-first member and deletes it again in teardown; when the two run
    // concurrently, taking whatever sits at the top of this list can select that temporary
    // project moments before it is removed, and the update POST then 422s on a dangling
    // project_id ("Member and project mismatch").
    await projectCombobox.click();
    await projectCombobox.fill("LazyTimer");
    const projectOption = page
      .locator("#project-options")
      .getByRole("option")
      .first();
    await expect(projectOption).toBeVisible({ timeout: 15000 });
    await expect(projectOption).toHaveText("LazyTimer", { timeout: 15000 });
    await projectOption.click();
    await expect(page.locator("#project-options")).toHaveCount(0, {
      timeout: 15000,
    });

    await dateCombobox.click();
    const dateOption = page
      .locator("#date-options")
      .getByRole("option")
      .first();
    await expect(dateOption).toBeVisible({ timeout: 15000 });
    await dateOption.click();
    await expect(page.locator("#date-options")).toHaveCount(0, {
      timeout: 15000,
    });

    // The Description label has an empty htmlFor, so target the textarea directly.
    // Timestamped so each run's record is distinguishable in the shared dev database.
    const descriptionText = `QA automated update ${Date.now()}`;
    await page.locator("textarea").fill(descriptionText);

    const postUpdateResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/updates") &&
        response.request().method() === "POST",
      { timeout: 15000 },
    );
    await page.getByRole("button", { name: "Submit" }).click();

    // expect: Toast 'Successfully added updates!' appears immediately
    // Asserted first, since toasts auto-dismiss after exactly 5000ms. Note the plural
    // "updates" in the success message.
    await expect(page.getByText("Successfully added updates!")).toBeVisible({
      timeout: 5000,
    });

    // expect: POST /api/v1/updates fires with the update payload
    const response = await postUpdateResponse;
    const payload = response.request().postDataJSON();
    expect(payload).toMatchObject({
      update: {
        category: "idea_talk",
        description: descriptionText,
      },
    });
    expect(payload.update.member_id).toBeTruthy();
    expect(payload.update.project_id).toBeTruthy();
    expect(payload.update.meetup_id).toBeTruthy();

    // Record it now that creation is confirmed, so afterEach still cleans up if an
    // assertion below fails.
    createdUpdateDescription = descriptionText;

    // expect: Modal closes
    // Checked by ROLE: a "New Update" button still exists on the dashboard behind the modal.
    await expect(
      page.getByRole("heading", { name: "New Update" }),
    ).not.toBeVisible({ timeout: 15000 });
  });
});
