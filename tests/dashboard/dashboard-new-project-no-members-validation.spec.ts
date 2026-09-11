// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("New Project modal blocks submission with no members selected", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, open 'New Project' modal
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

    // expect: Modal open
    // The modal shows a "Loading..." state while GET
    // /api/v1/dashboard/create_project resolves, so wait for the real heading
    // with a bounded timeout before interacting with the form.
    await expect(
      page.getByRole("heading", { name: "New Project" }),
    ).toBeVisible({ timeout: 15000 });

    // The Name input's <label> has an empty htmlFor, so it provides no
    // accessible name. The Members field is also a text input but exposes
    // role=combobox and id="members", so disambiguate the Name input with
    // :not([role="combobox"]).
    const nameInput = page.locator('input[type="text"]:not([role="combobox"])');
    await expect(nameInput).toBeVisible({ timeout: 15000 });

    // 2. Type a project name (e.g. 'QA Test Project') but leave the Members
    // multi-select empty, then click Submit
    // Filling the Name field is required to advance validation past the name
    // check so the members-required message is what actually surfaces.
    await nameInput.fill("QA Test Project");

    // The Members combobox is left untouched/empty on purpose - do not click
    // into it, since clicking outside the modal panel would close it.
    const membersCombobox = page.getByRole("combobox", { name: "Members" });
    await expect(membersCombobox).toHaveValue("", { timeout: 15000 });

    // Register a non-blocking request collector BEFORE the click so we can
    // assert afterwards that no POST /api/v1/projects request was ever fired.
    const projectPosts: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/v1/projects") && r.method() === "POST") {
        projectPosts.push(r.url());
      }
    });
    await page.getByRole("button", { name: "Submit" }).click();

    // expect: Toast 'Select at least one member for the project' appears
    // immediately after the click. Asserted first since the toast
    // auto-dismisses after exactly 5000ms. Note: no trailing period, unlike
    // the blank-name validation message.
    await expect(
      page.getByText("Select at least one member for the project"),
    ).toBeVisible({ timeout: 5000 });

    // expect: No POST /api/v1/projects request fires
    expect(projectPosts).toEqual([]);

    // expect: Modal remains open
    await expect(
      page.getByRole("heading", { name: "New Project" }),
    ).toBeVisible({ timeout: 3000 });
  });
});
