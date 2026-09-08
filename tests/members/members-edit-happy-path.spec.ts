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

test.describe("Members", () => {
  let member: MemberFixture | null = null;

  test.beforeEach(async () => {
    member = await createMember({
      name: uniqueMemberName("Edit Target", test.info().workerIndex),
      status: "active",
      comment: "original comment",
    });
  });

  test.afterEach(async () => {
    if (member) {
      await cleanUp(`member ${member.id}`, () => deleteMemberById(member!.id));
      member = null;
    }
  });

  test("Edit member happy path saves changes and returns to previous page", async ({
    page,
  }) => {
    // 1. Navigate to /login, log in as admin, go to /members, open a member's detail
    //    modal, click the Edit icon link
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Password" }).fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await page.goto("/members");

    const memberCards = page
      .locator("div.grid > div")
      // Real MemberCards only. SkeletonMemberCard renders the same `div.grid > div` shape
      // with an <h1> whose span holds an empty pulse placeholder, so a heading-based
      // filter matches skeletons too and `.first()` can resolve to one while SWR is still
      // loading. Every real card renders "<n> Projects"; no skeleton does.
      .filter({ hasText: /\d+ Projects/ });
    await expect(memberCards.first()).toBeVisible({ timeout: 15000 });

    // A fixture member has no talks/projects, so it will not reliably appear on page 1
    // of the default /members list -- reach it via search instead. The waitForResponse
    // promise is created BEFORE typing so it cannot miss the request that fires ~300ms
    // after the last keystroke. The API is on http://localhost:3000, a different origin
    // from baseURL, so the URL is matched by substring rather than a baseURL-rooted glob.
    const searchResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/v1/members/search"),
      { timeout: 15000 },
    );
    const searchInput = page.getByRole("textbox", { name: "Search members..." });
    await searchInput.fill(member!.name);
    await searchResponsePromise;

    await expect(memberCards).toHaveCount(1, { timeout: 15000 });
    await expect(
      memberCards.getByRole("heading", { name: member!.name }),
    ).toBeVisible({ timeout: 15000 });
    await memberCards.click();

    // The Edit control in the member detail modal is an icon-only link with no
    // accessible name, so it is addressed by its href shape instead of role/name.
    const editLink = page.locator('a[href^="/member/"][href$="/edit"]');
    await editLink.click();

    // expect: Navigates to /member/<id>/edit with the form pre-filled from the member's
    // current data
    await expect(page).toHaveURL(`/member/${member!.id}/edit`, { timeout: 15000 });
    const nameInput = page.getByRole("textbox", { name: "Name" });
    await expect(nameInput).toHaveValue(member!.name, { timeout: 15000 });

    // 2. Change the 'Comment' textarea to a new value and click 'Save Changes'
    const newComment = `updated comment ${Date.now()}`;
    const commentTextarea = page.getByRole("textbox", { name: "Comment" });
    await commentTextarea.fill(newComment);

    // The waitForRequest promise is created BEFORE clicking Save so it cannot miss the
    // PATCH that fires as soon as the submit handler runs.
    const patchRequestPromise = page.waitForRequest(
      (request) =>
        new URL(request.url()).pathname === `/api/v1/members/${member!.id}` &&
        request.method() === "PATCH",
      { timeout: 15000 },
    );
    await page.getByRole("button", { name: "Save Changes" }).click();

    // expect: PATCH /api/v1/members/<id> fires with the updated comment
    const patchRequest = await patchRequestPromise;
    expect(patchRequest.postData() ?? "").toContain(newComment);

    // expect: Page navigates back (router.back()) to /members
    await expect(page).toHaveURL("/members", { timeout: 15000 });
  });
});
