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
      label: "DeleteCancel",
      workerIndex: test.info().workerIndex,
    });
  });

  test.afterEach(async () => {
    if (meetup) {
      // destroyMeetupFixture looks the meetup up first, so it already tolerates the
      // case where the test itself deleted it.
      await cleanUp(`meetup ${meetup.number}`, () =>
        destroyMeetupFixture(meetup!),
      );
      meetup = null;
    }
  });

  test("Delete Meetup confirmation modal can be cancelled without deleting", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, open the FIXTURE meetup's detail modal
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
    const deleteMeetupButton = modal.getByRole("button", {
      name: "Delete Meetup",
    });

    // expect: 'Delete Meetup' button visible
    await expect(deleteMeetupButton).toBeVisible({ timeout: 15000 });

    // 2. Click 'Delete Meetup'
    // Register the dialog handler BEFORE clicking so the test proves intent and can
    // assert the dialog's exact message. handleDeleteMeetup calls the native confirm()
    // synchronously, so Playwright will wait for this handler to resolve before the
    // click() call itself resolves.
    const dialogMessages: string[] = [];
    page.once("dialog", async (dialog) => {
      dialogMessages.push(dialog.message());
      expect(dialog.type()).toBe("confirm");
      // 3. Dismiss/cancel the confirm dialog -- never accept(), which would really
      // delete the fixture meetup.
      await dialog.dismiss();
    });

    // Attach the listener BEFORE clicking -- a listener array is the reliable way to
    // assert a request never fires, unlike waitForRequest with a timeout. The Rails API
    // is a different origin from the app under test, so match by pathname, never a
    // baseURL-rooted glob.
    const deleteRequests: string[] = [];
    page.on("request", (request) => {
      if (
        new URL(request.url()).pathname === `/api/v1/meetups/${meetup!.id}` &&
        request.method() === "DELETE"
      ) {
        deleteRequests.push(request.url());
      }
    });

    await deleteMeetupButton.click();

    // expect: A native browser confirm() dialog appears with text mentioning associated
    // updates will also be deleted
    expect(dialogMessages).toEqual([
      "Are you sure you want to delete this meetup? All associated updates will also be deleted.",
    ]);

    // expect: No DELETE /api/v1/meetups/<id> request fires. dismiss() never touches the
    // network, so give any accidental request time to arrive before asserting the
    // listener recorded nothing.
    await page.waitForTimeout(1000);
    expect(deleteRequests).toEqual([]);

    // expect: The meetup remains in the list unchanged -- the modal stays open on the
    // list view showing the original heading, and no success toast (which only appears
    // on a real delete) is shown.
    await expect(
      modal.getByRole("heading", {
        level: 2,
        name: `Meetup ${meetup!.number}`,
        exact: true,
      }),
    ).toBeVisible({ timeout: 15000 });
    await expect(deleteMeetupButton).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText("Meetup deleted successfully"),
    ).not.toBeVisible();

    // Close the modal and confirm the fixture's card heading is still in the grid.
    const closeButton = modal.getByRole("button", { name: "Close" });
    await closeButton.click();
    await expect(fixtureCardHeading).toBeVisible({ timeout: 15000 });

    // Strongest check -- assert server-side that the record still exists, proving Cancel
    // truly discarded the delete rather than merely hiding it in the UI.
    const stillThere = await findMeetupByNumber(meetup!.number);
    expect(stillThere?.id).toBe(meetup!.id);
  });
});
