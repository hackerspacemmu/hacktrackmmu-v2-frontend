// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("Switching category to Hackathon swaps the pre-filled Number", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, open 'New Meetup' modal
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

    await page.getByRole("button", { name: "New Meetup" }).click();
    await expect(page.getByRole("heading", { name: "New Meetup" })).toBeVisible(
      { timeout: 15000 },
    );

    // expect: Number field shows the next regular-meetup number, 'Regular
    // Meetup' radio is checked
    // The Number label has an empty htmlFor and provides no accessible
    // name, so the spinbutton is targeted by its input type instead.
    const numberInput = page.locator('input[type="number"]');
    const regularMeetupRadio = page.getByRole("radio", {
      name: "Regular Meetup",
    });
    const hackathonRadio = page.getByRole("radio", { name: "Hackathon" });

    await expect(regularMeetupRadio).toBeChecked({ timeout: 15000 });
    await expect(numberInput).toBeVisible({ timeout: 15000 });
    const regularNumberText = await numberInput.inputValue();
    const regularNumber = Number(regularNumberText);
    expect(Number.isInteger(regularNumber)).toBe(true);
    expect(regularNumber).toBeGreaterThan(0);

    // 2. Click the 'Hackathon' radio button
    await hackathonRadio.click();

    // expect: Number field value updates to the next hackathon number
    // instead
    await expect(hackathonRadio).toBeChecked({ timeout: 15000 });
    await expect(regularMeetupRadio).not.toBeChecked({ timeout: 15000 });
    // Wait (with an auto-retrying, bounded assertion) for React's state
    // update to swap the Number value away from the regular-meetup number,
    // rather than reading the input synchronously right after the click.
    await expect(numberInput).not.toHaveValue(regularNumberText, {
      timeout: 15000,
    });

    const hackathonNumberText = await numberInput.inputValue();
    const hackathonNumber = Number(hackathonNumberText);
    expect(Number.isInteger(hackathonNumber)).toBe(true);
    expect(hackathonNumber).toBeGreaterThan(0);
    expect(hackathonNumber).not.toBe(regularNumber);
  });
});
