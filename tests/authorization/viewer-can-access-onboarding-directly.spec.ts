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

test.describe("Authorization", () => {
  let member: MemberFixture | null = null;

  test.beforeEach(async () => {
    // Fixture is created directly at "registered" -- an onboarding status -- so it sits
    // inside the onboarding page's default Registered/Contacted/First Talk Given filter.
    // contact_number and comment are populated so the table's Contact Number/Comment
    // columns have non-empty cells to assert against. The PUT probe below is issued
    // against this fixture and never against a real onboarding member.
    member = await createMember({
      name: uniqueMemberName("Authz Onb", test.info().workerIndex),
      status: "registered",
      contact_number: "0123456789",
      comment: "E2E authz onboarding probe comment",
    });
  });

  test.afterEach(async () => {
    // Tolerates the case where the PUT probe above turned out to be a DELETE that
    // succeeded (it didn't here, but deleteMemberById treats a 404 as success either
    // way, per its own doc comment).
    if (member) {
      await cleanUp(`member ${member.id}`, () => deleteMemberById(member!.id));
      member = null;
    }
  });

  test("Viewer can access /onboarding directly by URL despite the nav link being hidden (authorization gap)", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as viewer ('hacking things together')
    await page.goto("/login");
    const passwordInput = page.getByRole("textbox", { name: "Password" });
    const loginButton = page.getByRole("button", { name: "Login" });
    await passwordInput.fill("hacking things together");
    await loginButton.click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });

    // expect: Nav bar does NOT show an 'Onboarding' link
    // Scoped to the top <nav>: the slide-in Sidebar is a sibling <nav> that mirrors the
    // same links and, even closed, is only translated off-screen -- which Playwright
    // still reports as visible -- so an unscoped locator would be a strict-mode hazard.
    const topNav = page.getByRole("navigation").first();
    await expect(topNav.getByRole("button", { name: "Logout" })).toBeVisible({
      timeout: 15000,
    });
    await expect(
      topNav.getByRole("link", { name: "Onboarding" }),
    ).not.toBeVisible();

    // 2. Navigate directly to the URL /onboarding
    await page.goto("/onboarding");

    // expect FINDING: the page loads fully rather than redirecting or showing a
    // forbidden state -- confirmed by the URL staying on /onboarding (no bounce to
    // /login or /dashboard) and the full table (with its real columns) rendering.
    await expect(page).toHaveURL("/onboarding", { timeout: 15000 });

    const table = page.locator("table");
    const headerRow = table.locator("thead tr");
    await expect(
      headerRow.getByRole("columnheader", { name: "Name" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      headerRow.getByRole("columnheader", { name: "Contact Number" }),
    ).toBeVisible();
    await expect(
      headerRow.getByRole("columnheader", { name: "Register Date" }),
    ).toBeVisible();
    await expect(
      headerRow.getByRole("columnheader", { name: "Comment" }),
    ).toBeVisible();
    await expect(
      headerRow.getByRole("columnheader", { name: "Status" }),
    ).toBeVisible();
    await expect(
      headerRow.getByRole("columnheader", { name: "Options" }),
    ).toBeVisible();

    // The tbody renders a single placeholder <tr> reading "Loading..." (and later
    // "No members found") when there is no data, so waiting on `tr` alone would be
    // satisfied by that placeholder. Only a real member row carries a View button, so
    // key the "loaded" check off that instead.
    const tableBody = table.locator("tbody");
    const dataRows = tableBody
      .locator("tr")
      .filter({ has: page.getByRole("button", { name: "View", exact: true }) });
    await expect(dataRows.first()).toBeVisible({ timeout: 15000 });

    // Locate the fixture's row by searching for its unique name -- never by position --
    // so the probe below can only ever touch the row this test owns. The waitForResponse
    // promise is armed BEFORE typing so it cannot miss the request that fires ~300ms
    // after the last keystroke. The Rails API is on http://localhost:3000, a different
    // origin from baseURL, so the URL is matched by substring rather than a
    // baseURL-rooted glob.
    const searchResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/members/search") &&
        response.request().method() === "GET",
      { timeout: 15000 },
    );
    await page
      .getByRole("textbox", { name: "Search members..." })
      .fill(member!.name);
    await searchResponsePromise;

    const memberRow = tableBody.locator("tr").filter({ hasText: member!.name });
    await expect(memberRow).toHaveCount(1, { timeout: 15000 });

    // expect: the onboarding table renders the same Name/Contact/Register
    // Date/Comment/Status/Options columns as the admin sees, including a working inline
    // Status change dropdown and View/Edit/Delete buttons for this row -- exactly as an
    // admin would see them, confirming there is no client-side isAdmin gate on this page.
    await expect(memberRow.getByRole("cell", { name: member!.name })).toBeVisible();
    await expect(memberRow.getByRole("cell", { name: "0123456789" })).toBeVisible();
    const statusSelect = memberRow.getByRole("combobox");
    await expect(statusSelect).toBeVisible();
    await expect(statusSelect).toHaveValue("registered");
    await expect(
      memberRow.getByRole("button", { name: "View", exact: true }),
    ).toBeVisible();
    const editLink = memberRow.locator(
      `a[href="/member/${member!.id}/edit?source=onboarding"]`,
    );
    await expect(editLink).toBeVisible();
    await expect(editLink.getByRole("button", { name: "Edit" })).toBeVisible();
    await expect(
      memberRow.getByRole("button", { name: "Delete", exact: true }),
    ).toBeVisible();

    // 3. The probe -- the point of this test. This documents that the onboarding page
    // performs no client-side isAdmin gate (unlike /members and /meetups modals); the
    // real severity of that gap depends on whether the underlying PUT actually mutates
    // data server-side, which is answered below by issuing one for real, against the
    // fixture row only, and capturing the response created BEFORE the click fires it.
    const putResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/v1/members/${member!.id}`) &&
        response.request().method() === "PUT",
    );
    await statusSelect.selectOption("contacted");

    // FINDING: live against the running backend, the viewer's PUT is answered 403
    // {"message":"Unauthorized"} -- the API rejects it server-side. This means the gap
    // documented above is a page-level-only issue (the UI renders controls it shouldn't
    // for a viewer), NOT a genuine server-side authorization hole: the backend already
    // enforces admin-only writes on this endpoint regardless of what the frontend shows.
    const putResponse = await putResponsePromise;
    expect(putResponse.status()).toBe(403);
    expect(await putResponse.json()).toEqual({ message: "Unauthorized" });

    // A 403 on the wire only proves the request was refused, not that nothing was
    // written -- and the <select> updates its own value optimistically, so the UI is no
    // evidence either way. Read the record back through the API (as admin) to confirm the
    // status is still the fixture's original "registered": that is what makes this a
    // page-level gap rather than a data-integrity one.
    const stored = await getMemberById(member!.id);
    expect(stored?.status).toBe("registered");
  });
});
