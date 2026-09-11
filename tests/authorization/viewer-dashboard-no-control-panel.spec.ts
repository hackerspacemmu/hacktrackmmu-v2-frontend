// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Authorization", () => {
  test("Viewer dashboard has no Control Panel and no create-action buttons", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as viewer ('hacking things together')
    await page.goto("/login");
    const passwordInput = page.getByRole("textbox", { name: "Password" });
    await passwordInput.fill("hacking things together");
    await page.getByRole("button", { name: "Login" }).click();

    // expect: Lands on /dashboard
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });

    // 2. Inspect the dashboard content
    // Scope to each section by its own heading, mirroring the admin-side
    // dashboard-loads-summary-sections.spec.ts. This lets the absence assertions below
    // be anchored to real data having rendered, rather than to the Control Panel heading
    // itself -- dashboard.tsx's SKELETON branch also renders a "Control Panel" heading
    // (it is isAdmin-gated too) over three SkeletonActionButtons while the meetups SWR
    // call is in flight, so a negative check made during that window could pass for the
    // wrong reason. Gating on real, non-skeleton cards first guarantees the dashboard has
    // moved past the loading branch before we assert anything is missing.
    const meetupsSection = page.locator(".mt-10").filter({
      has: page.getByRole("heading", { name: "Meetups", exact: true }),
    });
    const hackathonsSection = page.locator(".mt-10").filter({
      has: page.getByRole("heading", { name: "Hackathons", exact: true }),
    });
    // SkeletonMemberCard also renders an <h1>, but an empty one, so a bare
    // { level: 1 } locator would count the loading skeletons as members. Requiring a
    // non-blank accessible name matches only real member cards.
    const membersSection = page.locator(".mt-10").filter({
      has: page.getByRole("heading", { name: "Active Members", exact: true }),
    });

    // expect: Meetups/Hackathons/Active Members sections still render read-only.
    // Matched by number pattern rather than a specific card, since another worker's
    // reserved-range fixture meetup can occupy the top slot in this parallel-safe,
    // read-only scenario -- only the heading + at least one real card is asserted.
    await expect(
      meetupsSection.getByRole("heading", { name: "Meetups", exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      meetupsSection.getByRole("heading", { name: /^Meetup \d+/ }).first(),
    ).toBeVisible({ timeout: 15000 });

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

    await expect(
      membersSection.getByRole("heading", {
        name: "Active Members",
        exact: true,
      }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      membersSection.getByRole("heading", { level: 1, name: /\S/ }).first(),
    ).toBeVisible({ timeout: 15000 });

    // expect: No 'Control Panel' heading and no New Meetup/New Project/New Update buttons
    // are present. The real-card assertions above already prove the dashboard finished
    // loading (past the isAdmin-gated skeleton branch), so these absence checks cannot be
    // passing merely because the page is still mid-fetch.
    await expect(
      page.getByRole("heading", { name: "Control Panel" }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "New Meetup" }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "New Project" }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "New Update" }),
    ).not.toBeVisible();
  });
});
