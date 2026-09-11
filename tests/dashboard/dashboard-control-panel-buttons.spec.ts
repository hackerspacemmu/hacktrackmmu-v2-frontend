// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("Admin Control Panel exposes exactly New Meetup, New Project, New Update", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, land on /dashboard
    await page.goto("/login");
    const passwordInput = page.getByRole("textbox", { name: "Password" });
    await passwordInput.fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });

    // expect: Control Panel section is visible
    await expect(
      page.getByRole("heading", { name: "Control Panel" }),
    ).toBeVisible({ timeout: 15000 });
    // The "Control Panel" heading alone is NOT proof the dashboard finished loading:
    // dashboard.tsx renders that same heading over three SkeletonActionButtons while
    // the meetups SWR call is still in flight. Gate on a real action button instead.
    await expect(page.getByRole("button", { name: "New Meetup" })).toBeVisible({
      timeout: 30000,
    });

    // 2. Enumerate buttons inside the Control Panel grid
    // The Control Panel grid is the only `div.grid` on the dashboard that contains
    // buttons (the Meetups/Hackathons/Active Members sections use `div.grid` too, but
    // for their card lists, which have no buttons), so filtering by "has a button" is
    // enough to scope to it uniquely without relying on a fragile CSS class match.
    const controlPanelGrid = page
      .locator("div.grid")
      .filter({ has: page.getByRole("button") });

    // expect: Exactly three buttons are present: 'New Meetup', 'New Project', 'New Update'
    await expect(controlPanelGrid.getByRole("button")).toHaveCount(3, {
      timeout: 15000,
    });
    await expect(controlPanelGrid.getByRole("button")).toHaveText(
      ["New Meetup", "New Project", "New Update"],
      { timeout: 15000 },
    );

    // expect: No 'New Member' button exists anywhere on the dashboard (there is no UI
    // path to create a member; this documents current behavior, not necessarily desired
    // behavior). NewMemberActionButton exists in
    // src/components/Admin/ActionButton/NewMemberActionButton but is never rendered
    // by ControlPanel, so this is dead code that this test intentionally pins down.
    await expect(
      page.getByRole("button", { name: "New Member" }),
    ).not.toBeVisible({ timeout: 3000 });
  });
});
