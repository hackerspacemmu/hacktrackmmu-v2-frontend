// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";
import {
  cleanUp,
  createMember,
  deleteMemberById,
  getMemberById,
  uniqueMemberName,
  type MemberFixture,
} from "../support/api";

test.describe("Members", () => {
  let member: MemberFixture | null = null;

  test.beforeEach(async () => {
    member = await createMember({
      name: uniqueMemberName("Edit Validation", test.info().workerIndex),
      status: "active",
    });
  });

  test.afterEach(async () => {
    if (member) {
      await cleanUp(`member ${member.id}`, () => deleteMemberById(member!.id));
      member = null;
    }
  });

  test("Edit member blocks submission when Name or Email is cleared", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, open the FIXTURE member's edit page directly
    //    via /member/<fixture-id>/edit
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Password" }).fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await page.goto(`/member/${member!.id}/edit`);

    // expect: Form pre-filled with existing Name and Email
    const nameInput = page.getByRole("textbox", { name: "Name" });
    const emailInput = page.getByRole("textbox", { name: "Email" });
    await expect(nameInput).toHaveValue(member!.name, { timeout: 15000 });
    await expect(emailInput).toHaveValue(member!.email, { timeout: 15000 });

    // 2. Select all text in the Name field and delete it, then click 'Save Changes'
    await nameInput.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Delete");
    await expect(nameInput).toHaveValue("");

    // The listener is attached BEFORE clicking Save so it cannot miss a PATCH that fires
    // as soon as the submit handler runs. A recorded-requests array -- rather than
    // waitForRequest with a timeout -- is the reliable way to assert a request never fires,
    // since native validation should block the submit handler from ever running.
    const patchRequests: string[] = [];
    page.on("request", (request) => {
      if (
        new URL(request.url()).pathname === `/api/v1/members/${member!.id}` &&
        request.method() === "PATCH"
      ) {
        patchRequests.push(request.url());
      }
    });
    await page.getByRole("button", { name: "Save Changes" }).click();

    // expect: Browser's native required-field validation blocks submission (no PATCH
    // request fires)
    const nameValidity = await page.evaluate(() => {
      const el = document.querySelector("#name") as HTMLInputElement | null;
      return el?.validity.valueMissing;
    });
    expect(nameValidity).toBe(true);

    // Give a request that should never fire time to appear before asserting its absence.
    await page.waitForTimeout(1000);
    expect(patchRequests).toEqual([]);

    // expect: Page remains on the edit form
    await expect(page).toHaveURL(`/member/${member!.id}/edit`, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Edit Member" })).toBeVisible();

    // 3. Click 'Cancel'
    await page.getByRole("button", { name: "Cancel" }).click();

    // expect: Navigates back without persisting the empty Name (original data is unaffected
    // since nothing was saved)
    await expect(page).toHaveURL("/dashboard", { timeout: 15000 });
    expect(patchRequests).toEqual([]);

    // Confirmed against the server rather than inferred from the missing PATCH: the
    // stored record still holds its original Name and Email, so clearing the field and
    // cancelling truly persisted nothing.
    const persisted = await getMemberById(member!.id);
    expect(persisted?.name).toBe(member!.name);
    expect(persisted?.email).toBe(member!.email);
  });
});
