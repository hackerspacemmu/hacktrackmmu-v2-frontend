// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("Admin Control Panel exposes exactly New Meetup, New Project, New Update, Meetup First Timers, M&G First Timers", async ({
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
    const controlPanelGrid = page.getByTestId("control-panel");

    // expect: Exactly five buttons are present, all in one row on desktop:
    // 'New Meetup', 'New Project', 'New Update', then 'Meetup First Timers' and
    // 'M&G First Timers' sharing the fourth slot as two square-ish buttons
    await expect(controlPanelGrid.getByRole("button")).toHaveCount(5, {
      timeout: 15000,
    });
    await expect(controlPanelGrid.getByRole("button")).toHaveText(
      [
        "New Meetup",
        "New Project",
        "New Update",
        "Meetup First Timers",
        "M&G First Timers",
      ],
      { timeout: 15000 },
    );

    // expect: On desktop all five sit in one row, and the two QR buttons split the
    // fourth slot between them, so each is about half as wide as an admin button.
    const box = async (name: string) =>
      (await controlPanelGrid.getByRole("button", { name }).boundingBox())!;
    const meetup = await box("New Meetup");
    const update = await box("New Update");
    const session = await box("Meetup First Timers");
    const mg = await box("M&G First Timers");
    for (const b of [update, session, mg]) {
      expect(Math.abs(b.y - meetup.y)).toBeLessThan(2);
      expect(Math.abs(b.height - meetup.height)).toBeLessThan(2);
    }
    expect(session.x).toBeGreaterThan(update.x + update.width);
    expect(mg.x).toBeGreaterThan(session.x + session.width);
    expect(session.width).toBeLessThan(meetup.width * 0.6);
    expect(Math.abs(session.width - mg.width)).toBeLessThan(2);
    expect(mg.x + mg.width - session.x).toBeLessThan(meetup.width + 2);

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
