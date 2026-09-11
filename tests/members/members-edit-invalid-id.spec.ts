// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

// This test PINS CURRENT BUGGY BEHAVIOUR: GET /api/v1/members/:id for a
// non-existent id returns HTTP 200 with a null body instead of a 404. Because
// SWR only enters its error branch on a rejected/failed request, this 200
// response never triggers `memberError`, so the edit page silently renders a
// completely blank "Edit Member" form instead of its "Error occurred" state
// -- with no indication to the user that member 999999 does not exist. If the
// backend is ever fixed to return 404 for unknown ids, this test is expected
// to fail and should be updated to assert the error state instead.
test.describe("Members", () => {
  test("Editing a non-existent member id silently renders a blank form (edge case / bug)", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, navigate directly to
    // /member/999999/edit (an id that does not exist)
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Password" }).fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });

    // Register the response listener before navigating so the very first
    // /api/v1/members/999999 response is captured.
    const memberResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/v1/members/999999",
    );
    await page.goto("/member/999999/edit");

    // expect: GET /api/v1/members/999999 responds 200 OK with a null body
    // (backend quirk -- not a 404)
    const memberResponse = await memberResponsePromise;
    expect(memberResponse.status()).toBe(200);
    expect(await memberResponse.json()).toBeNull();

    // expect: Because the SWR call never errors, the page skips its 'Error
    // occurred' state and instead renders the 'Edit Member' form with every
    // field blank/empty and no error message shown to the user
    await expect(page).toHaveURL("/member/999999/edit", { timeout: 15000 });
    await expect(page).toHaveTitle("HackTrack", { timeout: 15000 });
    await expect(
      page.getByRole("heading", { name: "Edit Member" }),
    ).toBeVisible({ timeout: 15000 });

    // expect: This documents a real gap: there is no user-facing indication
    // that member 999999 does not exist -- the 'Error occurred' branch never
    // renders, and no other error message is shown.
    await expect(page.getByRole("heading", { name: "Error occurred" })).toHaveCount(
      0,
    );

    const emptyFieldIds = [
      "#name",
      "#email",
      "#student_id",
      "#discord_tag",
      "#contact_number",
      "#comment",
      "#status",
      "#faculty",
      "#year_joined",
      "#instagram_handle",
      "#affiliation_with_mmu",
    ];
    for (const fieldId of emptyFieldIds) {
      const field = page.locator(fieldId);
      await expect(field).toHaveCount(1);
      await expect(field).toHaveValue("", { timeout: 15000 });
    }

    // Reinforces the gap: the user gets a fully interactive form for a
    // member that does not exist, with no disabled/error affordance.
    await expect(
      page.getByRole("button", { name: "Save Changes" }),
    ).toBeEnabled({ timeout: 15000 });
  });
});
