// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Onboarding", () => {
  test("Onboarding table loads on desktop viewport with default First-Talk-Given-and-earlier filter", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, then click the 'Onboarding' link in the nav
    //    (desktop viewport — the default 1280x720 Desktop Chrome viewport is fine).
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Password" }).fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    // Scope to the top nav bar rather than `.first()` on the link itself. The slide-in
    // Sidebar is a SIBLING of this <nav> and renders the same links, and its Onboarding
    // link is gated on `isAdmin` alone while the desktop one needs `isClient && isAdmin`
    // -- so during the hydration window the sidebar's copy is the FIRST match in the DOM.
    // The closed sidebar is translated off-screen (-translate-x-full), which Playwright
    // still reports as visible, so `.first().click()` times out with "element is outside
    // of the viewport" rather than failing fast.
    const desktopNav = page.getByRole("navigation").first();
    await desktopNav.getByRole("link", { name: "Onboarding" }).click();

    // expect: URL is /onboarding
    await expect(page).toHaveURL("/onboarding", { timeout: 15000 });

    // expect: A <table> renders with column headers Name, Contact Number, Register Date,
    // Comment, Status, Options
    const table = page.locator("table");
    await expect(table).toBeVisible({ timeout: 15000 });
    await expect(
      table.getByRole("columnheader", { name: "Name" }),
    ).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "Contact Number" }),
    ).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "Register Date" }),
    ).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "Comment" }),
    ).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "Status" }),
    ).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "Options" }),
    ).toBeVisible();

    // expect: The default status chips show Registered, Contacted and First Talk Given
    // Scope to the chip container (div.currentStatusMap, per onboarding.tsx) since plain
    // member names in the table body can otherwise collide with the same status text.
    const statusChips = page.locator("div.currentStatusMap");
    await expect(
      statusChips.getByText("Registered", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      statusChips.getByText("Contacted", { exact: true }),
    ).toBeVisible();
    await expect(
      statusChips.getByText("First Talk Given", { exact: true }),
    ).toBeVisible();

    // expect: A data row has View, Edit and Delete controls plus a Status <select>
    // Do not assert an exact global row count — other test workers create and delete
    // fixture members concurrently. Just check the first data row has every control.
    const firstRow = table.locator("tbody tr").first();
    await expect(firstRow.getByRole("button", { name: "View", exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(firstRow.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    await expect(
      firstRow.getByRole("button", { name: "Delete", exact: true }),
    ).toBeVisible();
    // The status <select> has no accessible name/label, so target it by tag scoped to
    // the row rather than by role, and confirm it carries the full status option list.
    const statusSelect = firstRow.locator("select");
    await expect(statusSelect).toBeVisible();
    await expect(statusSelect.locator("option")).toHaveCount(10);
  });
});
