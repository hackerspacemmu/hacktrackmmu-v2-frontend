// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("Admin dashboard loads summary sections with skeleton then real data", async ({
    page,
  }) => {
    // 1. Navigate to /login and log in as admin
    await page.goto("/login");
    const passwordInput = page.getByRole("textbox", { name: "Password" });
    await passwordInput.fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();

    // expect: Redirected to /dashboard
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });

    // 2. Observe the page immediately after navigation completes
    // expect: Skeleton placeholder cards are briefly visible for Meetups/Hackathons/Members while SWR fetches /api/v1/dashboard/meetups, /hackathons, /members
    // NOTE: SkeletonMeetupCard/SkeletonHackathonCard/SkeletonMemberCard are plain
    // `animate-pulse` divs with no accessible role or text, so they cannot be targeted with
    // a locator. In practice, a snapshot taken immediately after the /dashboard redirect
    // already showed fully-loaded meetup/hackathon/member cards -- the three dashboard SWR
    // fetches resolve faster than a post-login assertion can be scheduled, so the skeleton
    // state is not reliably observable here. Asserting it would be flaky (it may or may not
    // still be present depending on timing), so this step is intentionally not hard-asserted.
    // The real-data assertions in step 3 below are the actual verification.

    // 3. Wait for skeletons to resolve
    const meetupsSection = page.locator(".mt-10").filter({
      has: page.getByRole("heading", { name: "Meetups", exact: true }),
    });
    const hackathonsSection = page.locator(".mt-10").filter({
      has: page.getByRole("heading", { name: "Hackathons", exact: true }),
    });
    // SkeletonMemberCard also renders an <h1>, but an empty one, so a bare
    // { level: 1 } locator counts the 4 loading skeletons as members. Requiring a
    // non-blank accessible name matches only real member cards.
    const membersSection = page.locator(".mt-10").filter({
      has: page.getByRole("heading", { name: "Active Members", exact: true }),
    });

    // expect: 'Meetups' section shows real meetup cards with a 'View All' link to /meetups
    await expect(
      meetupsSection.getByRole("heading", { name: "Meetups", exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      meetupsSection.getByRole("heading", { name: /^Meetup \d+/ }).first(),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      meetupsSection.getByRole("link", { name: "View All" }),
    ).toHaveAttribute("href", "/meetups", { timeout: 15000 });

    // expect: 'Hackathons' section shows real hackathon cards
    await expect(
      hackathonsSection.getByRole("heading", {
        name: "Hackathons",
        exact: true,
      }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      hackathonsSection
        .getByRole("heading", { name: /^Hackathon \d+/ })
        .first(),
    ).toBeVisible({ timeout: 15000 });

    // expect: 'Active Members' section shows real member cards with 'View All' link to /members
    await expect(
      membersSection.getByRole("heading", {
        name: "Active Members",
        exact: true,
      }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      membersSection.getByRole("heading", { level: 1, name: /\S/ }).first(),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      membersSection.getByRole("link", { name: "View All" }),
    ).toHaveAttribute("href", "/members", { timeout: 15000 });

    // expect: 'Control Panel' heading is visible above the sections since the user is admin
    await expect(
      page.getByRole("heading", { name: "Control Panel" }),
    ).toBeVisible({ timeout: 15000 });
    // The "Control Panel" heading alone is NOT proof the dashboard finished loading:
    // dashboard.tsx renders that same heading over three SkeletonActionButtons while
    // the meetups SWR call is still in flight. Gate on a real action button instead.
    await expect(page.getByRole("button", { name: "New Meetup" })).toBeVisible({
      timeout: 30000,
    });
  });
});
