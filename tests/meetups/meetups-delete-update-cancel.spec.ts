// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";
import {
  cleanUp,
  createMeetupFixture,
  destroyMeetupFixture,
  findMeetupByNumber,
  type MeetupFixture,
} from "../support/api";

test.describe("Meetups", () => {
  let meetup: MeetupFixture | null = null;

  test.beforeEach(async () => {
    meetup = await createMeetupFixture({
      label: "DelUpd",
      workerIndex: test.info().workerIndex,
      withUpdate: true,
    });
  });

  test.afterEach(async () => {
    if (meetup) {
      // destroyMeetupFixture looks the meetup up first, so it already tolerates the
      // case where the test itself deleted the update via a cascade.
      await cleanUp(`meetup ${meetup.number}`, () =>
        destroyMeetupFixture(meetup!),
      );
      meetup = null;
    }
  });

  test("Delete an update confirmation can be cancelled", async ({ page }) => {
    // 1. Navigate to /login, log in as admin, open the FIXTURE meetup's detail modal (it has exactly one update)
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
    const deleteUpdateButton = updateRow.getByRole("button").nth(1);

    // expect: Delete icon visible next to the update
    await expect(updateRow.getByRole("button")).toHaveCount(2, {
      timeout: 15000,
    });
    await expect(deleteUpdateButton).toBeVisible({ timeout: 15000 });

    // 2. Click the delete icon for an update
    // Register the dialog handler BEFORE clicking so the test proves intent and can
    // assert the dialog's exact message. handleDeleteClick calls the native confirm()
    // synchronously, so Playwright will wait for this handler to resolve before the
    // click() call itself resolves.
    const dialogMessages: string[] = [];
    page.once("dialog", async (dialog) => {
      dialogMessages.push(dialog.message());
      expect(dialog.type()).toBe("confirm");
      // 3. Dismiss/cancel the dialog -- never accept(), which would really delete the
      // fixture update.
      await dialog.dismiss();
    });

    // Attach the listener BEFORE clicking -- a listener array is the reliable way to
    // assert a request never fires, unlike waitForRequest with a timeout. The Rails API
    // is a different origin from the app under test, so match by pathname, never a
    // baseURL-rooted glob.
    const deleteRequests: string[] = [];
    page.on("request", (request) => {
      if (
        new URL(request.url()).pathname ===
          `/api/v1/updates/${meetup!.update!.id}` &&
        request.method() === "DELETE"
      ) {
        deleteRequests.push(request.url());
      }
    });

    await deleteUpdateButton.click();

    // expect: A native confirm() dialog appears asking to confirm deletion of the update
    expect(dialogMessages).toEqual([
      "Are you sure you want to delete this update?",
    ]);

    // expect: No DELETE /api/v1/updates/<id> request fires. dismiss() never touches the
    // network, so give any accidental request time to arrive before asserting the
    // listener recorded nothing.
    await page.waitForTimeout(1000);
    expect(deleteRequests).toEqual([]);

    // expect: The update remains listed
    await expect(
      modal.getByText(meetup!.update!.description, { exact: true }),
    ).toBeVisible({ timeout: 15000 });

    // The Details box still reads "1 updates" (lowercase in the modal; the card says
    // "1 Updates" with a capital U), confirming the update count is unchanged.
    await expect(modal.getByText("1 updates", { exact: true })).toBeVisible({
      timeout: 15000,
    });

    // On a successful delete the app toasts "Update deleted successfully" -- assert that
    // toast never appears.
    await expect(
      page.getByText("Update deleted successfully"),
    ).not.toBeVisible();

    // Strongest check -- assert server-side that the update still exists, proving Cancel
    // truly discarded the delete rather than merely hiding it in the UI.
    const stillThere = await findMeetupByNumber(meetup!.number);
    expect(stillThere?.updates.map((u) => u.id)).toContain(
      meetup!.update!.id,
    );
  });
});
