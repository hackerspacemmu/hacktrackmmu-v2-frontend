// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Onboarding", () => {
  test("Empty onboarding search shows a 'No members found' message", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, go to /onboarding
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Password" }).fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await page.goto("/onboarding");

    // expect: Rows loaded
    // The tbody renders a single placeholder <tr> reading "Loading..." (and later
    // "No members found") when there is no data, so waiting on `tr` alone would be
    // satisfied by that placeholder. Only a real member row carries a View button, so
    // key the "loaded" check off that instead.
    const table = page.locator("table");
    const tableBody = table.locator("tbody");
    const dataRows = tableBody
      .locator("tr")
      .filter({ has: page.getByRole("button", { name: "View", exact: true }) });
    await expect(dataRows.first()).toBeVisible({ timeout: 15000 });

    // 2. Type a nonsense query (use `zzzznonexistentmember`) into the search box and wait
    //    for the debounce
    // The search box debounces 300ms before firing GET /api/v1/members/search, so the
    // waitForResponse promise must be created before typing to avoid missing the request.
    const searchInput = page.getByRole("textbox", { name: "Search members..." });
    const searchResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/members/search") &&
        response.request().method() === "GET",
      { timeout: 15000 },
    );
    await searchInput.fill("zzzznonexistentmember");
    await searchResponsePromise;

    // expect: The table body shows a 'No members found' message spanning the row instead
    // of any data rows
    // While loading, the same cell briefly reads "Loading...", so assert on the exact
    // "No members found" text rather than merely on row absence.
    await expect(tableBody.locator("tr")).toHaveCount(1, { timeout: 15000 });
    const emptyRow = tableBody.locator("tr").first();
    // A single <td colSpan={6}> renders the message, spanning what would otherwise be
    // six data columns.
    await expect(emptyRow.locator("td")).toHaveCount(1);
    await expect(emptyRow).toHaveText("No members found");
  });
});
