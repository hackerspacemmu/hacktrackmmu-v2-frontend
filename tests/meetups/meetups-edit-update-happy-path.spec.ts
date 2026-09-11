// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";
import {
  cleanUp,
  createMeetupFixture,
  destroyMeetupFixture,
  type MeetupFixture,
} from "../support/api";

test.describe("Meetups", () => {
  let meetup: MeetupFixture | null = null;

  test.beforeEach(async () => {
    meetup = await createMeetupFixture({
      label: "EditUpd",
      workerIndex: test.info().workerIndex,
      withUpdate: true,
    });
  });

  test.afterEach(async () => {
    if (meetup) {
      await cleanUp(`meetup ${meetup.number}`, () =>
        destroyMeetupFixture(meetup!),
      );
      meetup = null;
    }
  });

  test("Edit an update from within the meetup modal", async ({ page }) => {
    // 1. Navigate to /login, log in as admin, open the FIXTURE meetup's detail modal (it has exactly one update), click the edit icon on that update
    await page.goto("/login");
    await page
      .getByRole("textbox", { name: "Password" })
      .fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await page.goto("/meetups");

    // Locate the fixture meetup's card by its NUMBER, never by position -- the meetups
    // list is ordered by id DESC (newest first), so a parallel worker's fixture -- created
    // moments after ours -- can occupy the top
    // slot in this 90000-band.
    const fixtureCardHeading = page.getByRole("heading", {
      name: `Meetup ${meetup!.number}`,
      exact: true,
    });
    await expect(fixtureCardHeading).toBeVisible({ timeout: 15000 });
    await fixtureCardHeading.click();

    // The modal is portaled to document.body, so it must be scoped by its own container --
    // the background card underneath renders near-identical "Host:"/"Date:" text and an
    // unscoped locator would match both.
    const modal = page.locator("div.max-w-md");

    // Per-update Edit/Delete buttons are icon-only with no accessible name. The fixture
    // has exactly one update, so its row -- scoped by the update's description text --
    // exposes exactly two icon buttons: index 0 = Edit, index 1 = Delete.
    const updateRow = modal.locator("div.border-b", {
      hasText: meetup!.update!.description,
    });
    await expect(updateRow.getByRole("button")).toHaveCount(2, {
      timeout: 15000,
    });
    await updateRow.getByRole("button").nth(0).click();

    // expect: Edit-update form shown with Category, Member/Project/Date dropdowns, and
    // Description pre-filled
    await expect(
      modal.getByRole("heading", { level: 2, name: "Edit Update", exact: true }),
    ).toBeVisible({ timeout: 15000 });

    const descriptionTextarea = modal.locator("textarea");
    await expect(descriptionTextarea).toHaveValue(
      meetup!.update!.description,
      { timeout: 15000 },
    );

    await expect(
      modal.getByRole("radio", { name: "Idea Talk" }),
    ).toBeChecked({ timeout: 15000 });

    // Each SearchableDropdown ("By"/"For"/"On") renders a visible <input role="combobox">
    // plus a screen-reader-only native <select> that ALSO resolves to an implicit
    // "combobox" role -- verified live: getByRole("combobox") yields 6 elements, not 3.
    // Scope to the visible input elements to match exactly the three dropdowns.
    await expect(modal.locator('input[role="combobox"]')).toHaveCount(3, {
      timeout: 15000,
    });

    // 2. Change the Description text and save
    const newDescription = `E2E EditUpd update EDITED ${Date.now()}`;
    const oldDescription = meetup!.update!.description;
    await descriptionTextarea.fill(newDescription);

    // Rails API is a different origin from the app under test -- match by pathname, never
    // a baseURL-rooted glob.
    const patchResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          `/api/v1/updates/${meetup!.update!.id}` &&
        response.request().method() === "PATCH",
      { timeout: 15000 },
    );

    await modal.getByRole("button", { name: "Save" }).click();

    // expect: Toast 'Update edited successfully!' appears immediately
    // The handler awaits a 500ms sleep and re-fetches BEFORE showing the toast, and the
    // toast auto-dismisses at 5000ms, so assert right after the click without a long wait.
    await expect(page.getByText("Update edited successfully!")).toBeVisible({
      timeout: 4500,
    });

    // expect: PATCH /api/v1/updates/<id> fires
    const patchResponse = await patchResponsePromise;
    const patchBody = patchResponse.request().postDataJSON();
    expect(patchBody.update.description).toBe(newDescription);

    // expect: Modal shows the updated description
    //
    // Asserted against the STILL-OPEN modal, deliberately. src/pages/meetups.tsx used to
    // render meetup cards with `key={index}`, so any post-save refetch that re-ordered the
    // list rebound the open modal to whatever meetup happened to land at that array index
    // -- under `--workers=4` this modal really did end up showing a different meetup. The
    // key is now `key={meetup.id}`, so asserting on the open modal here doubles as
    // regression cover: if index-based keys ever come back, this fails.

    await expect(
      modal.getByRole("heading", {
        level: 2,
        name: `Meetup ${meetup!.number}`,
        exact: true,
      }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      modal.getByText(newDescription, { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      modal.getByText(oldDescription, { exact: true }),
    ).toHaveCount(0, { timeout: 15000 });
  });
});
