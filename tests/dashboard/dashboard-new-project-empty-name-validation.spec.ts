// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("New Project modal blocks submission with empty name", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, land on /dashboard, click 'New Project'
    await page.goto("/login");
    const passwordInput = page.getByRole("textbox", { name: "Password" });
    await passwordInput.fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await expect(
      page.getByRole("heading", { name: "Control Panel" }),
    ).toBeVisible({ timeout: 15000 });
    // The "Control Panel" heading alone is NOT proof the dashboard finished loading:
    // dashboard.tsx renders that same heading over three SkeletonActionButtons while
    // the meetups SWR call is still in flight. Gate on a real action button instead.
    await expect(page.getByRole("button", { name: "New Meetup" })).toBeVisible({
      timeout: 30000,
    });

    await page.getByRole("button", { name: "New Project" }).click();

    // expect: Modal titled 'New Project' opens with an empty Name field, Members
    // multi-select, Category radios (Project/Group Project), and an
    // 'Is Project Completed?' checkbox
    // The modal shows a "Loading..." state while GET
    // /api/v1/dashboard/create_project resolves, so wait for the real heading
    // with a bounded timeout before asserting the form fields.
    await expect(
      page.getByRole("heading", { name: "New Project" }),
    ).toBeVisible({ timeout: 15000 });

    // The Name input's <label> has an empty htmlFor, so it provides no
    // accessible name. The Members field is also a text input but exposes
    // role=combobox and id="members", so disambiguate the Name input with
    // :not([role="combobox"]).
    const nameInput = page.locator('input[type="text"]:not([role="combobox"])');
    await expect(nameInput).toHaveValue("", { timeout: 15000 });

    const membersCombobox = page.getByRole("combobox", { name: "Members" });
    await expect(membersCombobox).toBeVisible({ timeout: 15000 });

    const projectRadio = page.getByRole("radio", {
      name: "Project",
      exact: true,
    });
    await expect(projectRadio).toBeVisible({ timeout: 15000 });

    const groupProjectRadio = page.getByRole("radio", {
      name: "Group Project",
    });
    await expect(groupProjectRadio).toBeVisible({ timeout: 15000 });

    const isCompletedCheckbox = page.getByRole("checkbox", {
      name: "Is Project Completed?",
    });
    await expect(isCompletedCheckbox).toBeVisible({ timeout: 15000 });

    // 2. Click Submit with Name left blank
    // Register a non-blocking request collector BEFORE the click so we can
    // assert afterwards that no POST /api/v1/projects request was ever fired.
    const projectPosts: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/v1/projects") && r.method() === "POST") {
        projectPosts.push(r.url());
      }
    });
    await page.getByRole("button", { name: "Submit" }).click();

    // expect: Toast 'Project Name is required.' appears immediately after the
    // click. Asserted first since the toast auto-dismisses after exactly
    // 5000ms.
    await expect(page.getByText("Project Name is required.")).toBeVisible({
      timeout: 5000,
    });

    // expect: No POST /api/v1/projects request fires
    expect(projectPosts).toEqual([]);

    // expect: Modal remains open
    await expect(
      page.getByRole("heading", { name: "New Project" }),
    ).toBeVisible({ timeout: 3000 });
  });
});
