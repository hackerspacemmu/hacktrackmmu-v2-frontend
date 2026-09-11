// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Members", () => {
  test("Clicking a member card opens its detail modal with Projects and Talks", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, go to /members
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Password" }).fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await page.goto("/members");

    // expect: Cards loaded
    const memberCards = page
      .locator("div.grid > div")
      // Real MemberCards only. SkeletonMemberCard renders the same `div.grid > div` shape
      // with an <h1> whose span holds an empty pulse placeholder, so a heading-based
      // filter matches skeletons too and `.first()` can resolve to one while SWR is still
      // loading. Every real card renders "<n> Projects"; no skeleton does.
      .filter({ hasText: /\d+ Projects/ });
    await expect(memberCards.first()).toBeVisible({ timeout: 15000 });

    // 2. Click on a member card
    // The first card in the current dataset might belong to a member with no
    // projects/talks (Projects would read "No projects made" and Talks "No updates
    // made"), so pick the first card whose text does not read "0 Projects" to
    // guarantee real talk rows to assert on below.
    const cardWithTalks = memberCards
      .filter({ hasNotText: "0 Projects" })
      .first();
    // MemberCard renders the name and the status label as two separate spans inside
    // the same <h1>, so the name span is read directly instead of parsing the
    // combined "<name> <status>" accessible name.
    const memberName = await cardWithTalks
      .getByRole("heading")
      .locator("span")
      .first()
      .innerText();
    await cardWithTalks.getByRole("heading").click();

    // expect: Page title updates to "HackTrack - <name>'s profile"
    await expect(page).toHaveTitle(`HackTrack - ${memberName}'s profile`, {
      timeout: 15000,
    });

    // expect: A modal opens showing the member's name, an 'Edit' icon link to
    // /member/<id>/edit, a 'Projects' section, a 'Talks' section listing updates
    // with category/author/date, and an 'Other Information' section
    await expect(
      page.getByRole("heading", { name: memberName, level: 2 }),
    ).toBeVisible({ timeout: 15000 });
    // The Edit control is an icon-only <a href="/member/<id>/edit"> (a lucide
    // PenLine, no text), so it is addressed by its href pattern instead of an
    // accessible name.
    const editLink = page.locator('a[href^="/member/"][href$="/edit"]');
    await expect(editLink).toBeVisible({ timeout: 5000 });
    const editHref = await editLink.getAttribute("href");
    expect(editHref).toMatch(/^\/member\/\d+\/edit$/);
    await expect(
      page.getByRole("heading", { name: "Projects", level: 3 }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByRole("heading", { name: "Talks", level: 3 }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByRole("heading", { name: "Other Information", level: 3 }),
    ).toBeVisible({ timeout: 5000 });
    // Reading MemberCard's source: each talk row actually renders the PROJECT name,
    // a category icon (Lightbulb for idea_talk / Hammer for progress_talk), the
    // update description, and a formatted date like "Sep 8, 2024" -- there is no
    // author name rendered anywhere in a talk row, unlike the plan's
    // "category/author/date" wording. Asserting what is really there: a date in
    // that format is visible inside the Talks section.
    const talksSection = page
      .getByRole("heading", { name: "Talks", level: 3 })
      .locator("xpath=following-sibling::div[1]");
    await expect(
      talksSection.getByText(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/).first(),
    ).toBeVisible({ timeout: 5000 });

    // 3. Click 'Close'
    await page.getByRole("button", { name: "Close" }).click();

    // expect: Modal closes, member list remains visible underneath
    await expect(
      page.getByRole("button", { name: "Close" }),
    ).not.toBeVisible({ timeout: 3000 });
    await expect(memberCards.first()).toBeVisible({ timeout: 5000 });
  });
});
