// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";
import { cleanUp, deleteProjectByName } from "../support/api";

test.describe("Dashboard", () => {
  // This spec creates a real project attached to a real seeded member, so it removes it
  // again afterwards rather than accumulating records in the shared dev database.
  let createdProjectName: string | null = null;

  test.afterEach(async () => {
    if (createdProjectName) {
      await cleanUp(`project "${createdProjectName}"`, () =>
        deleteProjectByName(createdProjectName as string),
      );
      createdProjectName = null;
    }
  });

  test("New Project modal happy path creates a project", async ({ page }) => {
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
    // The modal renders a transient "Loading..." state while
    // GET /api/v1/dashboard/create_project resolves, so wait for the real heading.
    await expect(
      page.getByRole("heading", { name: "New Project" }),
    ).toBeVisible({ timeout: 15000 });

    // 2. Type a project name, select at least one member from the Members dropdown,
    //    leave Category as 'Project', click Submit
    // The Name label has an empty htmlFor so it gives the input no accessible name.
    // The Members input is also type=text, so exclude it via its combobox role.
    const nameInput = page.locator('input[type="text"]:not([role="combobox"])');
    const projectName = `QA Test Project ${Date.now()}`;
    await nameInput.fill(projectName);

    const membersCombobox = page.getByRole("combobox", { name: "Members" });
    await membersCombobox.click();

    // The options list is portaled to document.body, outside the modal. ModalLayout
    // deliberately ignores mousedowns on [role="listbox"]/[role="option"], so clicking
    // an option does not close the modal.
    const memberOptions = page.locator("#members-options");
    const firstMemberOption = memberOptions.getByRole("option").first();
    await expect(firstMemberOption).toBeVisible({ timeout: 15000 });
    const selectedMemberName = (
      (await firstMemberOption.textContent()) || ""
    ).trim();
    await firstMemberOption.click();

    // MultiSelectDropdown's handleSelect intentionally KEEPS the dropdown open for
    // additional selections. Left open, the portaled listbox overlays the modal and
    // intercepts the Submit click (the click would retry until timeout), and the
    // member's name would match both the chip and the still-rendered option, tripping
    // strict mode. Escape closes the list via the component's own keydown handler
    // without dispatching an outside mousedown, which would have closed the modal.
    await membersCombobox.press("Escape");
    await expect(memberOptions).toHaveCount(0, { timeout: 15000 });

    // The selection is now represented by a single removable chip in the modal.
    await expect(
      page.getByRole("button", { name: `Remove ${selectedMemberName}` }),
    ).toBeVisible({ timeout: 15000 });

    // Category is left at its default 'Project'.
    await expect(
      page.getByRole("radio", { name: "Project", exact: true }),
    ).toBeChecked({
      timeout: 15000,
    });

    const postProjectResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/projects") &&
        response.request().method() === "POST",
      { timeout: 15000 },
    );
    await page.getByRole("button", { name: "Submit" }).click();

    // expect: Toast 'Successfully added project!' appears immediately
    // Asserted first, since toasts auto-dismiss after exactly 5000ms.
    await expect(page.getByText("Successfully added project!")).toBeVisible({
      timeout: 5000,
    });

    // expect: POST /api/v1/projects fires with the project payload
    const response = await postProjectResponse;
    const payload = response.request().postDataJSON();
    expect(payload).toMatchObject({
      project: {
        name: projectName,
        category: "project",
        completed: false,
      },
    });
    expect(Array.isArray(payload.project.member_ids)).toBe(true);
    expect(payload.project.member_ids.length).toBeGreaterThan(0);

    // Record it now that creation is confirmed, so afterEach still cleans up if an
    // assertion below fails.
    createdProjectName = projectName;

    // expect: Modal closes
    // Checked by ROLE: a "New Project" button still exists on the dashboard behind
    // the modal, so only the heading disappearing proves the modal closed.
    await expect(
      page.getByRole("heading", { name: "New Project" }),
    ).not.toBeVisible({ timeout: 15000 });
  });
});
