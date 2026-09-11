// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";
import { cleanUp, deleteMeetupByNumber } from "../support/api";

test.describe("Dashboard", () => {
  // This spec creates a real meetup. Without teardown it is destructive in a compounding
  // way: each run permanently promotes a member out of the finite "Yet To Host" pool and
  // pushes the next-meetup-number counter up for good.
  let createdMeetupNumber: string | null = null;

  test.afterEach(async () => {
    if (createdMeetupNumber) {
      await cleanUp(`meetup ${createdMeetupNumber}`, () =>
        deleteMeetupByNumber(createdMeetupNumber as string),
      );
      createdMeetupNumber = null;
    }
  });

  test("New Meetup modal happy path creates a regular meetup", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, land on /dashboard
    await page.goto("/login");
    const passwordInput = page.getByRole("textbox", { name: "Password" });
    await passwordInput.fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });

    // expect: Dashboard loaded
    await expect(
      page.getByRole("heading", { name: "Control Panel" }),
    ).toBeVisible({ timeout: 15000 });
    // The "Control Panel" heading alone is NOT proof the dashboard finished loading:
    // dashboard.tsx renders that same heading over three SkeletonActionButtons while
    // the meetups SWR call is still in flight. Gate on a real action button instead.
    await expect(page.getByRole("button", { name: "New Meetup" })).toBeVisible({
      timeout: 30000,
    });

    // 2. Click 'New Meetup'
    await page.getByRole("button", { name: "New Meetup" }).click();

    // expect: Modal titled 'New Meetup' opens with Number (pre-filled with next meetup
    // number), Date (pre-filled to today), a searchable Host dropdown grouped 'Yet To
    // Host'/'Have Hosted', and Category radios defaulting to 'Regular Meetup'
    await expect(page.getByRole("heading", { name: "New Meetup" })).toBeVisible(
      { timeout: 15000 },
    );

    // The Number and Date <label>s use an empty htmlFor, so they are not associated
    // with their inputs for accessible-name lookups; target by input type instead,
    // which is unambiguous since only one modal is ever open at a time.
    const numberInput = page.locator('input[type="number"]');
    const dateInput = page.locator('input[type="date"]');
    const hostCombobox = page.getByRole("combobox", { name: "Host" });

    // The next meetup number increments every time this test runs against the shared
    // dev database, so capture the pre-filled value instead of hardcoding it.
    const capturedNumber = await numberInput.inputValue();
    expect(Number(capturedNumber)).toBeGreaterThan(0);

    const todayIso = new Date().toISOString().split("T")[0];
    await expect(dateInput).toHaveValue(todayIso, { timeout: 15000 });

    await expect(
      page.getByRole("radio", { name: "Regular Meetup" }),
    ).toBeChecked({ timeout: 15000 });
    await expect(
      page.getByRole("radio", { name: "Hackathon" }),
    ).not.toBeChecked({ timeout: 3000 });

    await hostCombobox.click();

    // The options listbox is portaled to document.body, outside the modal, grouped by
    // plain (non-option) "Yet To Host" / "Have Hosted" headers.
    const hostOptions = page.locator("#host-options");
    await expect(hostOptions.getByRole("option").first()).toBeVisible({
      timeout: 15000,
    });

    // Grouping is asserted as "at least one of the two group headers renders" rather
    // than "both do". SelectDropdown only emits a header for a group that still has
    // members, and this very test empties the "Yet To Host" group one member at a time:
    // each run promotes the host it picks into "Have Hosted" permanently. Asserting both
    // headers made the test destroy its own precondition and start failing once the
    // finite "Yet To Host" pool ran dry.
    const groupHeaders = hostOptions.locator("li:not([role='option'])");
    await expect(groupHeaders.first()).toBeVisible({ timeout: 15000 });
    await expect(groupHeaders.first()).toHaveText(/Yet To Host|Have Hosted/, {
      timeout: 15000,
    });

    // 3. Select any host from the Host dropdown and click Submit
    const firstHostOption = hostOptions.getByRole("option").first();
    const selectedHostName = (
      (await firstHostOption.textContent()) || ""
    ).trim();
    await firstHostOption.click();

    const postMeetupResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/meetups") &&
        response.request().method() === "POST",
      { timeout: 15000 },
    );
    await page.getByRole("button", { name: "Submit" }).click();

    // expect: Toast 'Successfully added meetup!' appears immediately
    await expect(page.getByText("Successfully added meetup!")).toBeVisible({
      timeout: 5000,
    });

    // expect: POST /api/v1/meetups is called with the regular-meetup payload
    const response = await postMeetupResponse;
    const payload = response.request().postDataJSON();
    expect(payload).toMatchObject({
      meetup: {
        date: todayIso,
        category: "regular_meetup",
        number: Number(capturedNumber),
      },
    });
    expect(payload.meetup.host_id).toBeTruthy();

    // Record it now that creation is confirmed, so afterEach still cleans up if an
    // assertion below fails.
    createdMeetupNumber = capturedNumber;

    // expect: Modal closes and the new meetup card appears in the Meetups section
    await expect(
      page.getByRole("heading", { name: "New Meetup" }),
    ).not.toBeVisible({ timeout: 15000 });

    // The dashboard renders three "mt-10"-wrapped sections (Meetups/Hackathons/Active
    // Members), each containing its own <h2>; scope to the one whose heading is
    // exactly "Meetups" so the assertions below can't match cards in other sections.
    const meetupsSection = page.locator("div.mt-10").filter({
      has: page.getByRole("heading", { name: "Meetups", exact: true }),
    });
    const newMeetupCard = meetupsSection.getByRole("heading", {
      name: `Meetup ${capturedNumber}`,
    });
    await expect(newMeetupCard).toBeVisible({ timeout: 15000 });
    // .first(): a host can appear on several meetup cards once they have hosted more
    // than once, so an unscoped match would trip strict mode.
    await expect(
      meetupsSection.getByText(selectedHostName, { exact: true }).first(),
    ).toBeVisible({ timeout: 15000 });
  });
});
