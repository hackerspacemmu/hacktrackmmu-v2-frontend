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
      label: "Edit",
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

  test("Edit Meetup happy path updates number, host, and date", async ({
    page,
  }) => {
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

    // expect: Form shows Number (spinbutton), a searchable Host dropdown, and a Date field
    // pre-filled with the fixture's current values
    await expect(
      modal.getByRole("heading", { level: 2, name: "Edit Meetup", exact: true }),
    ).toBeVisible({ timeout: 15000 });

    // The Number/Host/Date <label>s have no htmlFor, so they are not associated with
    // their inputs for accessible-name lookups -- address by role/type instead.
    const numberInput = modal.getByRole("spinbutton");
    const dateInput = modal.locator('input[type="date"]');
    // SearchableDropdown's host control is an <input role="combobox">, so its contents
    // live in the value attribute, not in text -- assert with toHaveValue, never
    // toHaveText (which reads "" for any input and silently never matches).
    const hostCombobox = modal.getByRole("combobox").first();

    await expect(numberInput).toHaveValue(String(meetup!.number), {
      timeout: 15000,
    });
    await expect(dateInput).toHaveValue(meetup!.date, { timeout: 15000 });
    // hostId is resolved asynchronously by matching the host name against
    // GET /api/v1/members?unpaginated=true, so allow time for it to populate.
    await expect(hostCombobox).toHaveValue(meetup!.host.name, {
      timeout: 15000,
    });

    // 2. Change the Date to a different valid date and click 'Save'
    const newDate = "2021-06-30";
    await dateInput.fill(newDate);

    // Save is disabled while isSaving || !hostId || hostId === "0" || !date; wait for it
    // to become enabled (host resolution can lag a moment behind the value appearing).
    const saveButton = modal.getByRole("button", { name: "Save" });
    await expect(saveButton).toBeEnabled({ timeout: 15000 });

    // Rails API is a different origin from the app under test -- match by pathname, never
    // a baseURL-rooted glob.
    const patchResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/v1/meetups/${meetup!.id}` &&
        response.request().method() === "PATCH",
      { timeout: 15000 },
    );

    await saveButton.click();

    // expect: Toast 'Meetup edited successfully!' appears immediately
    // The handler awaits a 500ms sleep and re-fetches BEFORE showing the toast, and the
    // toast auto-dismisses at 5000ms, so assert right after the click without a long wait.
    await expect(page.getByText("Meetup edited successfully!")).toBeVisible({
      timeout: 4500,
    });

    // expect: PATCH /api/v1/meetups/<id> fires with the updated payload
    const patchResponse = await patchResponsePromise;
    const patchBody = patchResponse.request().postDataJSON();
    expect(patchBody.meetup.date).toBe(newDate);
    expect(patchBody.meetup.number).toBe(meetup!.number);

    // expect: Modal returns to the list/detail view showing the new date
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
    // Date renders through the dateMod() formatter ("30 June 2021" for 2021-06-30), so
    // assert on the rendered form rather than the raw ISO string.
    //
    // Scoped to the <p>, not via getByText(/^Date:/): the markup is
    // `<p><strong>Date:</strong> {dateMod(date)}</p>`, and getByText resolves to the
    // SMALLEST element matching the pattern -- the <strong>, whose text is just "Date:"
    // and which can therefore never contain the formatted date.
    await expect(
      modal.locator("p").filter({ hasText: /^Date:/ }),
    ).toContainText("30 June 2021", { timeout: 15000 });
  });
});
