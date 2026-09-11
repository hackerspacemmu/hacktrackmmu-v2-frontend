// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";
import {
  cleanUp,
  createMeetupFixture,
  destroyMeetupFixture,
  type MeetupFixture,
} from "../support/api";

test.describe("Authorization", () => {
  let fixture: MeetupFixture | null = null;

  test.beforeEach(async () => {
    // A single meetup fixture supplies everything both halves of this scenario need: a
    // host MEMBER (status "active", so it appears under /members' default Active/Socially
    // Active filter), a fixture PROJECT, a fixture MEETUP (reserved 90000+ number band),
    // and one UPDATE attached to that meetup and authored by the host -- so the member
    // modal's Projects and Talks sections, and the meetup modal's Updates section, all have
    // a real row to assert the icon buttons on/off of.
    fixture = await createMeetupFixture({
      label: "Authz Viewer",
      workerIndex: test.info().workerIndex,
      withUpdate: true,
    });
  });

  test.afterEach(async () => {
    if (fixture) {
      await cleanUp(`meetup fixture ${fixture.number}`, () =>
        destroyMeetupFixture(fixture!),
      );
      fixture = null;
    }
  });

  test("Viewer member and meetup detail modals hide all edit/delete controls", async ({
    page,
  }) => {
    const passwordInput = page.getByRole("textbox", { name: "Password" });
    const loginButton = page.getByRole("button", { name: "Login" });
    // Scope nav-bar lookups to the top <nav>: the slide-in Sidebar is a sibling <nav> that
    // renders the same Logout button text, and merely being translated off-screen still
    // reports as "visible" to Playwright.
    const topNav = page.getByRole("navigation").first();
    const searchInput = page.getByRole("textbox", {
      name: "Search members...",
    });
    // Both the member and meetup detail modals are built from the same ModalLayout, which
    // portals to document.body as `<div class="... max-w-md ...">`, sitting outside #__next
    // as a sibling of the app root. The background page underneath renders near-identical
    // "Host:"/"Date:" text, so every assertion below is scoped to this container rather than
    // to `page` directly. Only one of the two modals is ever open at a time, so one locator
    // serves both halves of the test.
    const modal = page.locator("div.max-w-md");

    // 1. Navigate to /login, log in as viewer, go to /members, click any member card
    //    (admin half first -- pins down that the locators used below for the viewer really
    //    do match real edit/delete controls, per the plan's explicit comparison requirement)
    await page.goto("/login");
    await passwordInput.fill("secretarial slave");
    await loginButton.click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });

    await page.goto("/members");
    // Real MemberCards only -- SkeletonMemberCard renders the same grid shape with an
    // empty pulse placeholder, so waiting for a real "<n> Projects" card first avoids
    // searching before the page has left its loading branch.
    const memberCards = page
      .locator("div.grid > div")
      .filter({ hasText: /\d+ Projects/ });
    await expect(memberCards.first()).toBeVisible({ timeout: 15000 });

    // waitForResponse is armed before typing so it cannot miss the ~300ms-debounced request.
    let searchResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/v1/members/search"),
      { timeout: 15000 },
    );
    await searchInput.fill(fixture!.host.name);
    await searchResponsePromise;

    await page
      .getByRole("heading", { name: fixture!.host.name })
      .first()
      .click();

    // expect: Modal opens showing Projects/Talks/Other Information ... with an 'Edit' icon
    // link at the top and per-project/per-update edit and delete icon buttons (admin case)
    await expect(
      modal.getByRole("heading", { name: fixture!.host.name, level: 2 }),
    ).toBeVisible({ timeout: 15000 });

    // The Edit control is an icon-only <a href="/member/<id>/edit"> (a lucide PenLine, no
    // accessible name), so it is addressed by its href pattern -- same approach as
    // tests/members/members-card-opens-detail-modal.spec.ts.
    const editLink = modal.locator('a[href^="/member/"][href$="/edit"]');
    await expect(editLink).toBeVisible({ timeout: 5000 });
    await expect(editLink).toHaveAttribute(
      "href",
      `/member/${fixture!.host.id}/edit`,
    );

    // Projects/Talks rows are <div>s carrying a `border-b` class. Scoping by the fixture's
    // own project name / update description (rather than position) keeps the row unique
    // even if a section ever renders more than one entry.
    const projectsSection = modal
      .getByRole("heading", { name: "Projects", level: 3 })
      .locator("xpath=following-sibling::div[1]");
    const projectRow = projectsSection.locator("div.border-b", {
      hasText: fixture!.project!.name,
    });
    await expect(projectRow.getByRole("button")).toHaveCount(2, {
      timeout: 15000,
    });

    const talksSection = modal
      .getByRole("heading", { name: "Talks", level: 3 })
      .locator("xpath=following-sibling::div[1]");
    const talkRow = talksSection.locator("div.border-b", {
      hasText: fixture!.update!.description,
    });
    await expect(talkRow.getByRole("button")).toHaveCount(2, {
      timeout: 15000,
    });

    await modal.getByRole("button", { name: "Close" }).click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // 2. Close that modal, go to /meetups, click any meetup card (admin half)
    await page.goto("/meetups");
    // Locate the fixture meetup by its unique reserved number, never by position -- the
    // meetups list is ordered by id DESC (newest first), so another worker's fixture could
    // otherwise occupy the top slot in this 90000-band.
    const fixtureMeetupHeading = page.getByRole("heading", {
      name: `Meetup ${fixture!.number}`,
      exact: true,
    });
    await expect(fixtureMeetupHeading).toBeVisible({ timeout: 15000 });
    await fixtureMeetupHeading.click();

    // expect: Modal shows Host/Date/Updates and (as admin) 'Edit Meetup'/'Delete Meetup'
    // buttons plus per-update edit/delete icons
    await expect(
      modal.getByRole("heading", {
        level: 2,
        name: `Meetup ${fixture!.number}`,
        exact: true,
      }),
    ).toBeVisible({ timeout: 15000 });

    const editMeetupButton = modal.getByRole("button", { name: "Edit Meetup" });
    const deleteMeetupButton = modal.getByRole("button", {
      name: "Delete Meetup",
    });
    await expect(editMeetupButton).toBeVisible({ timeout: 15000 });
    await expect(deleteMeetupButton).toBeVisible({ timeout: 15000 });

    const meetupUpdateRow = modal.locator("div.border-b", {
      hasText: fixture!.update!.description,
    });
    await expect(meetupUpdateRow.getByRole("button")).toHaveCount(2, {
      timeout: 15000,
    });

    await modal.getByRole("button", { name: "Close" }).click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // 3. Log out, then log back in as VIEWER, to repeat both modals read-only
    await topNav.getByRole("button", { name: "Logout" }).click();
    // Wait for the real navigation to /login before reusing the password field -- logout
    // pushes the route before clearing auth state, so this is the true signal the admin
    // page has been torn down.
    await expect(page).toHaveURL("/login", { timeout: 15000 });
    await passwordInput.fill("hacking things together");
    await loginButton.click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });

    // 4. Navigate to /login, log in as viewer, go to /members, click the SAME fixture
    //    member card
    await page.goto("/members");
    await expect(memberCards.first()).toBeVisible({ timeout: 15000 });

    searchResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/v1/members/search"),
      { timeout: 15000 },
    );
    await searchInput.fill(fixture!.host.name);
    await searchResponsePromise;

    await page
      .getByRole("heading", { name: fixture!.host.name })
      .first()
      .click();

    // expect: Modal opens showing Projects/Talks/Other Information, but with NO 'Edit' icon
    // link at the top and NO per-project/per-update edit or delete icon buttons. Each
    // absence check below is anchored to its section's own heading having rendered first, so
    // it cannot pass merely because the modal had not opened yet.
    await expect(
      modal.getByRole("heading", { name: "Projects", level: 3 }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      modal.getByRole("heading", { name: "Talks", level: 3 }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      modal.getByRole("heading", { name: "Other Information", level: 3 }),
    ).toBeVisible({ timeout: 15000 });

    // A button count of 0 is only meaningful if the row it is counted inside actually
    // rendered -- an absent row would report 0 buttons just as convincingly as a
    // control-free one. Assert each fixture row is present first, so "no buttons" can
    // only mean the isAdmin-gated icons were withheld.
    await expect(projectRow).toBeVisible({ timeout: 15000 });
    await expect(talkRow).toBeVisible({ timeout: 15000 });

    await expect(editLink).not.toBeVisible();
    await expect(projectRow.getByRole("button")).toHaveCount(0, {
      timeout: 15000,
    });
    await expect(talkRow.getByRole("button")).toHaveCount(0, {
      timeout: 15000,
    });

    await modal.getByRole("button", { name: "Close" }).click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // 5. Close that modal, go to /meetups, click any meetup card (viewer half)
    await page.goto("/meetups");
    await expect(fixtureMeetupHeading).toBeVisible({ timeout: 15000 });
    await fixtureMeetupHeading.click();

    // expect: Modal shows Host/Date/Updates but NO 'Edit Meetup'/'Delete Meetup' buttons and
    // NO per-update edit/delete icons. Host/Date/Updates content is checked first so the
    // absence assertions below cannot be passing merely because the modal is still loading.
    await expect(
      modal.getByText(`Host: ${fixture!.host.name}`),
    ).toBeVisible({ timeout: 15000 });
    await expect(modal.getByText(/^Date:/)).toBeVisible({ timeout: 15000 });
    await expect(
      modal.getByRole("heading", { level: 3, name: "Updates", exact: true }),
    ).toBeVisible({ timeout: 15000 });

    // As above: anchor the zero-button count on the update row being present, so it
    // cannot pass because the row is missing rather than because its icons are hidden.
    await expect(meetupUpdateRow).toBeVisible({ timeout: 15000 });

    await expect(editMeetupButton).not.toBeVisible();
    await expect(deleteMeetupButton).not.toBeVisible();
    await expect(meetupUpdateRow.getByRole("button")).toHaveCount(0, {
      timeout: 15000,
    });
  });
});
