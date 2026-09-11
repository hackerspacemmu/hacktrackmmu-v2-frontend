// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";
import {
  cleanUp,
  createMember,
  deleteMemberById,
  uniqueMemberName,
  type MemberFixture,
} from "../support/api";

test.describe("Authorization", () => {
  let member: MemberFixture | null = null;

  test.beforeEach(async () => {
    // Populated with several fields -- not just name/email -- so "pre-filled just as it is
    // for admin" can be asserted against KNOWN values rather than against whatever happened
    // to already be on the record.
    member = await createMember({
      name: uniqueMemberName("Authz Edit", test.info().workerIndex),
      status: "active",
      contact_number: "0198765432",
      student_id: "1211109999",
      discord_tag: "authzedit",
      other_info: { faculty: "FCI" },
    });
  });

  test.afterEach(async () => {
    if (member) {
      await cleanUp(`member ${member.id}`, () => deleteMemberById(member!.id));
      member = null;
    }
  });

  test("A member edit page reached without admin rights still exposes Save Changes (no client-side role gate)", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as viewer, navigate directly to the FIXTURE member's
    //    /member/<fixture-id>/edit
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Password" }).fill("hacking things together");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await page.goto(`/member/${member!.id}/edit`);

    // expect: The edit form loads and is pre-filled just as it is for admin, with an
    // enabled 'Save Changes' button -- there is no client-side check that redirects a
    // viewer away from this page.
    //
    // A blank form and a loading form look alike (both render empty inputs), so rather
    // than waiting on the heading alone, anchor on the Name field actually holding the
    // fixture's value -- that only happens once SWR has resolved and the form has been
    // populated from real data.
    const nameInput = page.getByRole("textbox", { name: "Name" });
    await expect(nameInput).toHaveValue(member!.name, { timeout: 15000 });

    // The rest of the known fixture fields, including the nested "Other Information"
    // section, are checked too -- this is what distinguishes "pre-filled just as it is for
    // admin" from a coincidentally-matching Name field alone.
    await expect(page.getByRole("textbox", { name: "Email" })).toHaveValue(member!.email);
    await expect(page.getByRole("textbox", { name: "Student ID" })).toHaveValue(
      "1211109999",
    );
    await expect(page.getByRole("textbox", { name: "Discord Tag" })).toHaveValue(
      "authzedit",
    );
    await expect(page.getByRole("textbox", { name: "Contact Number" })).toHaveValue(
      "0198765432",
    );
    await expect(page.getByRole("textbox", { name: "Faculty" })).toHaveValue("FCI");

    // NOTE: this documents a UI-level gap only, not a server-side authorization hole -- the
    // sibling 7.6 spec already confirmed the Rails API rejects a viewer's
    // PUT /api/v1/members/:id with 403 {"message":"Unauthorized"}. The scope here is
    // limited to proving the button is present and enabled; Save is deliberately never
    // clicked.
    const saveButton = page.getByRole("button", { name: "Save Changes" });
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toBeEnabled();
  });
});
