// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";
import { captureTexts } from "../support/ui";

test.describe("Meetups", () => {
  test("Pagination navigates between pages of meetups", async ({ page }) => {
    // 1. Navigate to /login, log in as admin, go to /meetups
    await page.goto("/login");
    await page
      .getByRole("textbox", { name: "Password" })
      .fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });

    await page.goto("/meetups");

    // The page early-returns a skeleton-only layout while isLoading -- real cards and
    // skeletons never coexist -- but both the loading and loaded layouts render the same
    // "mt-10" sections and the same pagination control. Gate on real cards before reading
    // the pager or capturing any card names.
    const regularMeetupsSection = page.locator(".mt-10").filter({
      has: page.getByRole("heading", { name: "Regular Meetups", exact: true }),
    });
    const hackathonsSection = page.locator(".mt-10").filter({
      has: page.getByRole("heading", { name: "Hackathons", exact: true }),
    });
    const meetupHeadings = regularMeetupsSection.getByRole("heading", {
      name: /^Meetup \d+/,
    });
    const hackathonHeadings = hackathonsSection.getByRole("heading", {
      name: /^Hackathon \d+/,
    });
    await expect(meetupHeadings.first()).toBeVisible({ timeout: 15000 });
    await expect(hackathonHeadings.first()).toBeVisible({ timeout: 15000 });

    // expect: Pagination control shows page '1 - N'
    // The pill's chevron buttons have no accessible name, so address them positionally
    // within the pager container. Never hardcode the total page count since it shifts as
    // parallel workers' fixture meetups (the 90000 number band) come and go.
    const pager = page.locator("div.border-gray-200.rounded-full.w-fit");
    const paginationLabel = pager.locator("div", { hasText: /^\d+ - \d+$/ });
    const prevButton = pager.getByRole("button").first();
    const nextButton = pager.getByRole("button").last();
    await expect(paginationLabel).toHaveText(/^1 - \d+$/, { timeout: 15000 });

    // Capture page 1's heading texts without hardcoding any meetup/hackathon number --
    // fixture meetups from other parallel specs sort to the top of this list (ordered by
    // id DESC, newest first) and shift what page 1 actually contains between runs.
    //
    // Those fixtures are also filtered OUT of the captured sets, and the comparison below
    // tolerates a length change. Sections 4.3-4.8 each create a meetup in the reserved
    // 90000 band and delete it in afterEach, and because the list is ordered by id
    // DESC each live fixture OCCUPIES one of page 1's 28 slots -- pushing a real meetup
    // over onto page 2. So the real-meetup list on page 1 is always a prefix of the same
    // stable id-DESC ordering, but its LENGTH depends on how many fixtures happen to
    // exist at that instant. Filtering alone is not enough (that was verified: the naive
    // equality assertion failed under `--workers=4`); the round-trip check must compare
    // the two captures only over their common prefix.
    const withoutFixtureMeetups = (names: string[]) =>
      names.filter((name) => !/^Meetup 9\d{4}\b/.test(name));

    // Asserts one capture is a prefix of the other -- the strongest claim that holds while
    // parallel workers add and remove fixture meetups at the head of the list.
    const expectSameOrdering = (before: string[], after: string[]) => {
      const common = Math.min(before.length, after.length);
      expect(common).toBeGreaterThan(0);
      expect(after.slice(0, common)).toEqual(before.slice(0, common));
    };


    const page1MeetupNames = withoutFixtureMeetups(
      await captureTexts(meetupHeadings),
    );
    const page1HackathonNames = await captureTexts(hackathonHeadings);

    // 2. Click the next-page chevron
    const page2ResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.startsWith("/api/v1/meetups") &&
        new URL(response.url()).searchParams.get("page") === "2" &&
        response.request().method() === "GET",
      { timeout: 15000 },
    );
    await nextButton.click();

    // expect: GET /api/v1/meetups/?page=2 fires
    await page2ResponsePromise;
    await expect(paginationLabel).toHaveText(/^2 - \d+$/, { timeout: 15000 });

    // expect: Meetup and hackathon card sets update to a different page of data
    // Wait for real cards to re-render after the loading skeleton (which renders no
    // headings matching these regexes) clears, then diff against page 1's captured sets.
    await expect(meetupHeadings.first()).toBeVisible({ timeout: 15000 });
    await expect(hackathonHeadings.first()).toBeVisible({ timeout: 15000 });
    const page2MeetupNames = withoutFixtureMeetups(
      await captureTexts(meetupHeadings),
    );
    const page2HackathonNames = await captureTexts(hackathonHeadings);
    expect(page2MeetupNames.length).toBeGreaterThan(0);
    expect(page2MeetupNames).not.toEqual(page1MeetupNames);
    expect(page2HackathonNames).not.toEqual(page1HackathonNames);

    // 3. Click the previous-page chevron
    await prevButton.click();

    // expect: Returns to the original page 1 data
    await expect(paginationLabel).toHaveText(/^1 - \d+$/, { timeout: 15000 });
    await expect(meetupHeadings.first()).toBeVisible({ timeout: 15000 });
    await expect(hackathonHeadings.first()).toBeVisible({ timeout: 15000 });
    const page1MeetupNamesAgain = withoutFixtureMeetups(
      await captureTexts(meetupHeadings),
    );
    const page1HackathonNamesAgain = await captureTexts(hackathonHeadings);
    expectSameOrdering(page1MeetupNames, page1MeetupNamesAgain);
    // No spec creates hackathon fixtures, so the hackathon side of page 1 is stable and
    // can still be asserted for exact equality.
    expect(page1HackathonNamesAgain).toEqual(page1HackathonNames);
  });
});
