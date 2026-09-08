// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Meetups", () => {
  test("Meetups page loads Regular Meetups and Hackathons sections", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, click 'Meetups' in the nav
    await page.goto("/login");
    await page
      .getByRole("textbox", { name: "Password" })
      .fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await page.getByRole("link", { name: "Meetups" }).first().click();

    // expect: URL is /meetups
    await expect(page).toHaveURL("/meetups", { timeout: 30000 });

    // expect: Skeleton cards (28 placeholders each) appear briefly for both
    // 'Regular Meetups' and 'Hackathons' sections
    // NOTE: SkeletonMeetupCard/SkeletonHackathonCard are plain `animate-pulse` divs
    // with no accessible role or text, so they cannot be targeted with a semantic
    // locator. In practice a snapshot taken immediately after the nav click already
    // showed fully-loaded meetup/hackathon cards -- the meetups SWR fetch resolves
    // faster than a post-click assertion can be scheduled, so the skeleton state is
    // not reliably observable here. Asserting it would be flaky (it may or may not
    // still be present depending on timing), so this step is intentionally not
    // hard-asserted. The real-data assertions below are the actual verification.

    // expect: Real meetup and hackathon cards render after loading, each showing
    // number, host, date, and update count
    const regularMeetupsSection = page.locator(".mt-10").filter({
      has: page.getByRole("heading", { name: "Regular Meetups", exact: true }),
    });
    const hackathonsSection = page.locator(".mt-10").filter({
      has: page.getByRole("heading", { name: "Hackathons", exact: true }),
    });

    await expect(
      regularMeetupsSection.getByRole("heading", {
        name: "Regular Meetups",
        exact: true,
      }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      hackathonsSection.getByRole("heading", {
        name: "Hackathons",
        exact: true,
      }),
    ).toBeVisible({ timeout: 15000 });

    // Never assert an exact card count or a specific meetup number: fixture
    // meetups from other parallel specs occupy the 90000 number band and sort to
    // the front of this list. Assert "at least one real card" and its content
    // shape instead.
    const meetupCard = regularMeetupsSection
      .getByRole("heading", { name: /^Meetup \d+/ })
      .first();
    const hackathonCard = hackathonsSection
      .getByRole("heading", { name: /^Hackathon \d+/ })
      .first();

    await expect(meetupCard).toBeVisible({ timeout: 15000 });
    await expect(hackathonCard).toBeVisible({ timeout: 15000 });

    // Each real MeetupCard/HackathonCard renders "Host: <name>", "Date: <date>"
    // and "<n> Updates" as siblings inside the same card container.
    const meetupCardContainer = meetupCard.locator("..");
    const hackathonCardContainer = hackathonCard.locator("..");

    await expect(meetupCardContainer.getByText(/^Host:/)).toBeVisible({
      timeout: 15000,
    });
    await expect(meetupCardContainer.getByText(/^Date:/)).toBeVisible({
      timeout: 15000,
    });
    await expect(
      meetupCardContainer.getByText(/^\d+ Updates$/),
    ).toBeVisible({ timeout: 15000 });

    await expect(hackathonCardContainer.getByText(/^Host:/)).toBeVisible({
      timeout: 15000,
    });
    await expect(hackathonCardContainer.getByText(/^Date:/)).toBeVisible({
      timeout: 15000,
    });
    await expect(
      hackathonCardContainer.getByText(/^\d+ Updates$/),
    ).toBeVisible({ timeout: 15000 });
  });
});
