// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("New Meetup modal blocks submission without a host", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, land on /dashboard
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

    // click 'New Meetup'
    await page.getByRole("button", { name: "New Meetup" }).click();

    // expect: Modal opens with Host field empty
    await expect(page.getByRole("heading", { name: "New Meetup" })).toBeVisible(
      { timeout: 15000 },
    );

    const hostCombobox = page.getByRole("combobox", { name: "Host" });
    // The empty Host combobox presents as an empty value with a
    // "Search for a host..." placeholder rather than any pre-selected text.
    await expect(hostCombobox).toHaveValue("", { timeout: 15000 });
    await expect(hostCombobox).toHaveAttribute(
      "placeholder",
      "Search for a host...",
      { timeout: 15000 },
    );

    // 2. Click Submit without selecting a host
    // Register a non-blocking request collector BEFORE the click so we can
    // assert afterwards that no POST /api/v1/meetups request was ever fired.
    const meetupPosts: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/v1/meetups") && r.method() === "POST") {
        meetupPosts.push(r.url());
      }
    });
    await page.getByRole("button", { name: "Submit" }).click();

    // expect: Toast 'Host field is required.' appears immediately after the click
    // Asserted first since the toast auto-dismisses after exactly 5000ms.
    await expect(page.getByText("Host field is required.")).toBeVisible({
      timeout: 5000,
    });

    // expect: No POST /api/v1/meetups request fires
    expect(meetupPosts).toEqual([]);

    // expect: Modal remains open
    await expect(page.getByRole("heading", { name: "New Meetup" })).toBeVisible(
      { timeout: 3000 },
    );
  });
});
