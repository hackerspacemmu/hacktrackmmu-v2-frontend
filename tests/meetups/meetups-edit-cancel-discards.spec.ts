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
      label: "EditCancel",
      workerIndex: test.info().workerIndex,
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

  test("Edit Meetup Cancel discards changes", async ({ page }) => {
    // 1. Navigate to /login, log in as admin, open the FIXTURE meetup's detail modal, click 'Edit Meetup'
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
    const editMeetupButton = modal.getByRole("button", { name: "Edit Meetup" });
    await expect(editMeetupButton).toBeVisible({ timeout: 15000 });
    await editMeetupButton.click();

    // expect: Edit form shown with current values
    await expect(
      modal.getByRole("heading", { level: 2, name: "Edit Meetup", exact: true }),
    ).toBeVisible({ timeout: 15000 });

    // The Number/Date <label>s have no htmlFor, so they are not associated with their
    // inputs for accessible-name lookups -- address by role/type instead.
    const numberInput = modal.getByRole("spinbutton");
    const dateInput = modal.locator('input[type="date"]');

    await expect(numberInput).toHaveValue(String(meetup!.number), {
      timeout: 15000,
    });
    await expect(dateInput).toHaveValue(meetup!.date, { timeout: 15000 });

    // 2. Change the Number field value, then click 'Cancel' instead of 'Save'
    const changedNumber = String(meetup!.number + 5);
    await numberInput.fill(changedNumber);
    await expect(numberInput).toHaveValue(changedNumber);

    // Attach the listener BEFORE clicking Cancel -- a listener array is the reliable way
    // to assert a request never fires, unlike waitForRequest with a timeout. The Rails API
    // is a different origin from the app under test, so match by pathname, never a
    // baseURL-rooted glob.
    const patchRequests: string[] = [];
    page.on("request", (request) => {
      if (
        new URL(request.url()).pathname === `/api/v1/meetups/${meetup!.id}` &&
        request.method() === "PATCH"
      ) {
        patchRequests.push(request.url());
      }
    });

    const cancelButton = modal.getByRole("button", { name: "Cancel" });
    await cancelButton.click();

    // expect: No PATCH request fires. Cancel calls onCancel -> setModalView("list") and
    // never touches the network, so give any accidental request time to arrive before
    // asserting the listener recorded nothing.
    await page.waitForTimeout(1000);
    expect(patchRequests).toEqual([]);

    // expect: View returns to the meetup detail screen showing the original (unchanged)
    // number, and the Edit Meetup form is gone.
    await expect(
      modal.getByRole("heading", {
        level: 2,
        name: `Meetup ${meetup!.number}`,
        exact: true,
      }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      modal.getByRole("heading", { level: 2, name: "Edit Meetup", exact: true }),
    ).toHaveCount(0);

    // Also assert the original number is intact server-side after the whole flow -- this
    // proves Cancel truly discarded rather than merely hiding the change in the UI.
    const stillThere = await findMeetupByNumber(meetup!.number);
    expect(stillThere?.id).toBe(meetup!.id);

    // Reopen Edit Meetup and confirm the number input has reverted to the original value --
    // the form is remounted on each open, so it holds the fixture's real value again.
    await editMeetupButton.click();
    await expect(
      modal.getByRole("heading", { level: 2, name: "Edit Meetup", exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(numberInput).toHaveValue(String(meetup!.number), {
      timeout: 15000,
    });
  });
});
