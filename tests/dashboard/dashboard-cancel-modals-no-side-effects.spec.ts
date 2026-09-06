// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("Opening and cancelling each Control Panel modal makes no network mutation", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, land on /dashboard
    await page.goto("/login");
    const passwordInput = page.getByRole("textbox", { name: "Password" });
    await passwordInput.fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });

    // expect: Control Panel visible
    await expect(
      page.getByRole("heading", { name: "Control Panel" }),
    ).toBeVisible({ timeout: 15000 });
    // The "Control Panel" heading alone is NOT proof the dashboard finished loading:
    // dashboard.tsx renders that same heading over three SkeletonActionButtons while
    // the meetups SWR call is still in flight. Gate on a real action button instead.
    await expect(page.getByRole("button", { name: "New Meetup" })).toBeVisible({
      timeout: 30000,
    });

    // Non-blocking collectors for every mutation this test must prove did NOT happen.
    // waitForRequest is deliberately avoided: it would block for its full timeout by design.
    const mutations: string[] = [];
    page.on("request", (r) => {
      const url = r.url();
      const isMutation = ["POST", "PATCH", "PUT", "DELETE"].includes(
        r.method(),
      );
      if (
        isMutation &&
        (url.includes("/api/v1/meetups") ||
          url.includes("/api/v1/projects") ||
          url.includes("/api/v1/updates"))
      ) {
        mutations.push(`${r.method()} ${url}`);
      }
    });

    // Capture the dashboard's card counts up front so they can be compared at the end.
    const meetupsSection = page.locator("div.mt-10").filter({
      has: page.getByRole("heading", { name: "Meetups", exact: true }),
    });
    const hackathonsSection = page.locator("div.mt-10").filter({
      has: page.getByRole("heading", { name: "Hackathons", exact: true }),
    });
    // SkeletonMemberCard also renders an <h1>, but an empty one, so a bare
    // { level: 1 } locator counts the 4 loading skeletons as members. Requiring a
    // non-blank accessible name matches only real member cards.
    const membersSection = page.locator("div.mt-10").filter({
      has: page.getByRole("heading", { name: "Active Members", exact: true }),
    });
    // Meetups, Hackathons and Active Members are three INDEPENDENT SWR calls that resolve
    // at different times. All three must have rendered real cards before their counts are
    // captured -- otherwise a still-loading section is counted as 0 here and as its real
    // size at the end of the test, failing for reasons unrelated to the modals.
    await expect(
      meetupsSection.getByRole("heading", { name: /^Meetup \d+/ }).first(),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      hackathonsSection
        .getByRole("heading", { name: /^Hackathon \d+/ })
        .first(),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      membersSection.getByRole("heading", { level: 1, name: /\S/ }).first(),
    ).toBeVisible({ timeout: 15000 });
    const meetupCountBefore = await meetupsSection
      .getByRole("heading", { name: /^Meetup \d+/ })
      .count();
    const hackathonCountBefore = await hackathonsSection
      .getByRole("heading", { name: /^Hackathon \d+/ })
      .count();
    const memberCountBefore = await membersSection
      .getByRole("heading", { level: 1, name: /\S/ })
      .count();

    // The ModalLayout close control renders the HTML entity &times;.
    const closeButton = page.getByRole("button", { name: "×" });

    // 2. Open 'New Meetup' modal and click the '×' close button without filling anything
    await page.getByRole("button", { name: "New Meetup" }).click();
    await expect(page.getByRole("heading", { name: "New Meetup" })).toBeVisible(
      {
        timeout: 15000,
      },
    );
    await closeButton.click();

    // expect: Modal closes, no POST /api/v1/meetups request was made
    await expect(
      page.getByRole("heading", { name: "New Meetup" }),
    ).not.toBeVisible({ timeout: 15000 });
    expect(mutations).toEqual([]);

    // 3. Open 'New Project' modal and close it via '×'
    await page.getByRole("button", { name: "New Project" }).click();
    await expect(
      page.getByRole("heading", { name: "New Project" }),
    ).toBeVisible({ timeout: 15000 });
    await closeButton.click();

    // expect: No POST /api/v1/projects request was made
    await expect(
      page.getByRole("heading", { name: "New Project" }),
    ).not.toBeVisible({ timeout: 15000 });
    expect(mutations).toEqual([]);

    // 4. Open 'New Update' modal and close it via '×'
    await page.getByRole("button", { name: "New Update" }).click();
    await expect(page.getByRole("heading", { name: "New Update" })).toBeVisible(
      {
        timeout: 15000,
      },
    );
    await closeButton.click();

    // expect: No POST /api/v1/updates request was made
    await expect(
      page.getByRole("heading", { name: "New Update" }),
    ).not.toBeVisible({ timeout: 15000 });
    expect(mutations).toEqual([]);

    // expect: Dashboard counts/cards are unchanged from before the test
    await expect(
      meetupsSection.getByRole("heading", { name: /^Meetup \d+/ }),
    ).toHaveCount(meetupCountBefore, { timeout: 15000 });
    await expect(
      hackathonsSection.getByRole("heading", { name: /^Hackathon \d+/ }),
    ).toHaveCount(hackathonCountBefore, { timeout: 15000 });
    await expect(
      membersSection.getByRole("heading", { level: 1, name: /\S/ }),
    ).toHaveCount(memberCountBefore, { timeout: 15000 });
  });
});
