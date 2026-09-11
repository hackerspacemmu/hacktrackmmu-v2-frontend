// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("New Update modal enforces sequential required-field validation", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, land on /dashboard, click 'New Update'
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

    await page.getByRole("button", { name: "New Update" }).click();

    // expect: Modal titled 'New Update' opens with Category radios (Idea Talk/Progress
    // Talk), Member/Project/Date searchable dropdowns, and a Description textarea, all empty
    // Asserted by ROLE: a "New Update" button also exists on the dashboard behind the modal.
    await expect(page.getByRole("heading", { name: "New Update" })).toBeVisible(
      {
        timeout: 15000,
      },
    );

    const memberCombobox = page.getByRole("combobox", { name: "Member" });
    const projectCombobox = page.getByRole("combobox", { name: "Project" });
    const dateCombobox = page.getByRole("combobox", { name: "Date" });
    // The Description label has an empty htmlFor, so target the textarea directly.
    const description = page.locator("textarea");
    const submitButton = page.getByRole("button", { name: "Submit" });

    await expect(page.getByRole("radio", { name: "Idea Talk" })).toBeChecked({
      timeout: 15000,
    });
    await expect(
      page.getByRole("radio", { name: "Progress Talk" }),
    ).not.toBeChecked({ timeout: 3000 });
    await expect(memberCombobox).toHaveValue("", { timeout: 15000 });
    await expect(projectCombobox).toHaveValue("", { timeout: 15000 });
    await expect(dateCombobox).toHaveValue("", { timeout: 15000 });
    await expect(description).toHaveValue("", { timeout: 15000 });

    // No POST /api/v1/updates must fire across ANY of the five submits below. A
    // non-blocking request collector is used rather than waitForRequest, which would
    // block for its full timeout by design.
    const updatePosts: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/v1/updates") && r.method() === "POST") {
        updatePosts.push(r.url());
      }
    });

    // 2. Click Submit with everything empty
    await submitButton.click();

    // expect: Toast reads 'Host field is required.' immediately
    // NOTE: this is a copy-paste bug in the source. NewUpdateActionModal.tsx guards
    // `if (selectedMemberID === "")` but shows "Host field is required." -- it is
    // validating the MEMBER dropdown, not a host. The buggy string is asserted as-is so
    // this test pins current behavior; fixing the source should fail this assertion.
    await expect(page.getByText("Host field is required.")).toBeVisible({
      timeout: 5000,
    });

    // expect: No POST /api/v1/updates request fires
    expect(updatePosts).toEqual([]);

    // 3. Select a Member, then click Submit again
    // The Project dropdown is populated from the selected member's nested projects, so
    // this must be a member who actually has some, or step 4 would have nothing to pick.
    await memberCombobox.click();
    await memberCombobox.fill("Aarief");
    const memberOption = page
      .locator("#member-options")
      .getByRole("option")
      .first();
    await expect(memberOption).toBeVisible({ timeout: 15000 });
    await memberOption.click();
    // SearchableDropdown (single-select) closes itself on select, unlike the members
    // multi-select, so no Escape is needed here.
    await expect(page.locator("#member-options")).toHaveCount(0, {
      timeout: 15000,
    });

    await submitButton.click();

    // expect: Toast 'Project field is required.' appears
    await expect(page.getByText("Project field is required.")).toBeVisible({
      timeout: 5000,
    });

    // 4. Select a Project, then click Submit again
    await projectCombobox.click();
    const projectOption = page
      .locator("#project-options")
      .getByRole("option")
      .first();
    await expect(projectOption).toBeVisible({ timeout: 15000 });
    await projectOption.click();
    await expect(page.locator("#project-options")).toHaveCount(0, {
      timeout: 15000,
    });

    await submitButton.click();

    // expect: Toast 'Date field is required.' appears
    await expect(page.getByText("Date field is required.")).toBeVisible({
      timeout: 5000,
    });

    // 5. Select a Date, then click Submit again
    await dateCombobox.click();
    const dateOption = page
      .locator("#date-options")
      .getByRole("option")
      .first();
    await expect(dateOption).toBeVisible({ timeout: 15000 });
    await dateOption.click();
    await expect(page.locator("#date-options")).toHaveCount(0, {
      timeout: 15000,
    });

    await submitButton.click();

    // expect: Toast 'Description field is required.' appears
    await expect(page.getByText("Description field is required.")).toBeVisible({
      timeout: 5000,
    });

    // Description was never filled, so validation never passed and no update was created.
    expect(updatePosts).toEqual([]);
  });
});
