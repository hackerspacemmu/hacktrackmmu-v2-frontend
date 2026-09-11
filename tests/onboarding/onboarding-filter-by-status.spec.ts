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

test.describe("Onboarding", () => {
  // This scenario filters the list down to a SINGLE status and then asserts on the rows
  // that survive, so it needs at least one member at that status to exist. It cannot rely
  // on seed data for that: the backend currently holds ZERO `registered` members (all 32
  // onboarding members sit at `first_talk_given`), so without a fixture the table renders
  // "No members found" and the row assertions have nothing to check. The fixture is
  // read-only as far as shared data is concerned -- it is created and deleted by this spec.
  let member: MemberFixture | null = null;

  test.beforeEach(async () => {
    member = await createMember({
      name: uniqueMemberName("Onb Filter", test.info().workerIndex),
      status: "registered",
    });
  });

  test.afterEach(async () => {
    if (member) {
      await cleanUp(`member ${member.id}`, () => deleteMemberById(member!.id));
      member = null;
    }
  });

  test("Filter popover narrows onboarding list by a single status", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, go to /onboarding, open the Filter popover
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Password" }).fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await page.goto("/onboarding");
    await page.getByRole("button", { name: "Filter" }).click();

    // expect: The Status selector includes an 'All' option plus every member status
    // option (Registered, Contacted, First Talk Given, Never Active, Active, Socially
    // Active, Was Active, Was Socially Active, Terminated, Duplicate), and a 'Sort By'
    // selector offers Latest Registered / Earliest Registered / Recent Talks /
    // Alphabetical
    const popover = page.locator("div.absolute.top-full");
    await expect(popover).toBeVisible({ timeout: 15000 });
    // The Status and Sort By selects have no accessible name/label (Selector renders a
    // <label> with no htmlFor and a bare <select>), so scope to the popover and address
    // them positionally: nth(0) is Status, nth(1) is Sort By.
    const statusSelect = popover.locator("select").nth(0);
    const sortBySelect = popover.locator("select").nth(1);
    await expect(statusSelect).toHaveValue("all", { timeout: 15000 });
    await expect(statusSelect.locator("option")).toHaveText([
      "All",
      "Registered",
      "Contacted",
      "First Talk Given",
      "Never Active",
      "Active",
      "Socially Active",
      "Was Active",
      "Was Socially Active",
      "Terminated",
      "Duplicate",
    ]);
    await expect(sortBySelect).toHaveValue("newest", { timeout: 15000 });
    await expect(sortBySelect.locator("option")).toHaveText([
      "Latest Registered",
      "Earliest Registered",
      "Recent Talks",
      "Alphabetical",
    ]);

    // 2. Select 'Registered' only and click the popover's Filter (apply) button
    await statusSelect.selectOption("registered");
    const filteredResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/members/filtered") &&
        response.request().method() === "GET",
      { timeout: 15000 },
    );
    // The trigger button and the popover's apply button share the accessible name
    // "Filter", so scope the apply button to the popover to avoid strict-mode ambiguity.
    await popover.getByRole("button", { name: "Filter" }).click();

    // expect: A GET /api/v1/members/filtered request fires whose URL contains
    // status[]=registered (the browser encodes the query param as
    // "status%5B%5D=registered" on the wire, matching the members-page equivalent).
    const filteredResponse = await filteredResponsePromise;
    expect(filteredResponse.url()).toContain("status%5B%5D=registered");

    // expect: The popover closes
    await expect(popover).not.toBeVisible({ timeout: 15000 });

    // expect: The status chip area next to the heading now shows only 'Registered'
    const statusChips = page.locator("div.currentStatusMap");
    await expect(
      statusChips.getByText("Registered", { exact: true }),
    ).toBeVisible({ timeout: 15000 });

    // expect: The fixture member (status Registered) is among the rows that survive
    const table = page.locator("table");
    const tableBody = table.locator("tbody");
    await expect(
      tableBody.locator("tr").filter({ hasText: member!.name }),
    ).toHaveCount(1, { timeout: 15000 });

    // expect: Every visible row's status <select> has the value `registered`
    // Polled, and phrased as "the set of distinct values across all rows". Reading
    // `count()` once and looping would assert NOTHING if the read landed on a re-render
    // with zero rows -- a silently vacuous pass. Comparing the distinct set to exactly
    // ["registered"] requires rows to exist AND every one of them to be registered, and
    // reports the offending values on failure.
    const statusSelects = tableBody.locator("select");
    await expect
      .poll(
        () =>
          statusSelects.evaluateAll((selects) => [
            ...new Set(selects.map((s) => (s as HTMLSelectElement).value)),
          ]),
        { timeout: 15000 },
      )
      .toEqual(["registered"]);

    // expect: Pagination resets to page 1 (the pagination control at the bottom-right
    // reads '1 - <total>')
    const pager = page.locator("div.fixed.bottom-4");
    const paginationLabel = pager.locator("div", { hasText: /^\d+ - \d+$/ });
    await expect(paginationLabel).toHaveText(/^1 - \d+$/, { timeout: 15000 });
  });
});
