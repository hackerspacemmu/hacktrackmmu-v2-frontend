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
      label: "Detail Modal",
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

  test("Clicking a meetup card opens its detail modal with updates", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, go to /meetups
    await page.goto("/login");
    await page
      .getByRole("textbox", { name: "Password" })
      .fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await page.goto("/meetups");

    // expect: Cards loaded
    // Locate the fixture meetup's card by its NUMBER, never by position -- the meetups
    // list is ordered by id DESC (newest first), so a parallel worker's fixture -- created
    // moments after ours -- can occupy the top
    // slot in this 90000-band.
    const fixtureCardHeading = page.getByRole("heading", {
      name: `Meetup ${meetup!.number}`,
      exact: true,
    });
    await expect(fixtureCardHeading).toBeVisible({ timeout: 15000 });

    // 2. Locate the fixture meetup's card (it carries the reserved number) and click it
    await fixtureCardHeading.click();

    // expect: Page title updates to include the meetup number
    await expect(page).toHaveTitle(`HackTrack - Meetup ${meetup!.number}`, {
      timeout: 15000,
    });

    // expect: Modal opens showing Host, Date, update count, an 'Updates' list with each
    // update's description/category/author, and (as admin) 'Edit Meetup' and 'Delete
    // Meetup' buttons plus per-update edit/delete icons
    // The modal is portaled to document.body (verified live: it sits outside #__next,
    // as a direct sibling of the app root), so it must be scoped by its own container --
    // the background card underneath renders near-identical "Host:"/"Date:" text and an
    // unscoped locator would match both.
    const modal = page.locator("div.max-w-md");

    await expect(
      modal.getByRole("heading", {
        level: 2,
        name: `Meetup ${meetup!.number}`,
        exact: true,
      }),
    ).toBeVisible({ timeout: 15000 });

    await expect(modal.getByText(`Host: ${meetup!.host.name}`)).toBeVisible({
      timeout: 15000,
    });
    await expect(modal.getByText(/^Date:/)).toBeVisible({ timeout: 15000 });
    await expect(
      modal.getByText("1 updates", { exact: true }),
    ).toBeVisible({ timeout: 15000 });

    await expect(
      modal.getByRole("heading", { level: 3, name: "Updates", exact: true }),
    ).toBeVisible({ timeout: 15000 });

    // MeetupCard truncates project/member names longer than 40 characters to
    // `name.slice(0, 40) + "..."` (verified against the live component source); the
    // fixture's generated names exceed that, so this truncated form is what actually
    // renders in the Updates list.
    const truncatedProjectName =
      meetup!.project!.name.length > 40
        ? meetup!.project!.name.slice(0, 40) + "..."
        : meetup!.project!.name;
    const truncatedHostName =
      meetup!.host.name.length > 40
        ? meetup!.host.name.slice(0, 40) + "..."
        : meetup!.host.name;

    await expect(
      modal.getByText(truncatedProjectName, { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(modal.getByText("Category: Idea Talk")).toBeVisible({
      timeout: 15000,
    });
    await expect(modal.getByText(`By:${truncatedHostName}`)).toBeVisible({
      timeout: 15000,
    });
    await expect(
      modal.getByText(meetup!.update!.description, { exact: true }),
    ).toBeVisible({ timeout: 15000 });

    await expect(modal.getByRole("button", { name: "Edit Meetup" })).toBeVisible({
      timeout: 15000,
    });
    await expect(
      modal.getByRole("button", { name: "Delete Meetup" }),
    ).toBeVisible({ timeout: 15000 });

    // Per-update edit/delete icon buttons are icon-only with no accessible name
    // (verified live: index 0 is the blue Edit/square-pen icon, index 1 is the red
    // Delete/trash icon). The fixture has exactly one update, so its row -- scoped by the
    // update's description text -- must expose exactly two icon buttons.
    const updateRow = modal.locator("div.border-b", {
      hasText: meetup!.update!.description,
    });
    await expect(updateRow.getByRole("button")).toHaveCount(2, {
      timeout: 15000,
    });
  });
});
