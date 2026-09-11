// Shared UI-reading helpers.
//
// These exist for one recurring hazard in this app: several pages re-enter a
// skeleton-only layout *after* they have already rendered real data, so the usual
// "wait once, then read" shape is not atomic.
//
// Why the pages do that:
//   - /members and /onboarding build their SWR key from `token`, which starts empty until
//     the auth store hydrates, and rebuild it on every page/filter/sort change. A new key
//     means `isLoading` is true again, so the skeleton branch renders a second time.
//   - /meetups is worse: `getData()` sets `isLoading(true)` on every fetch and its
//     useCallback deps include `token`, so the same flash happens there.
//
// Why a visibility gate does not protect the read:
//   - Skeleton cards render the same container shape with an <h1> holding only an empty
//     pulse <div>, so text- and name-based locators match NOTHING while loading.
//   - The pagination pill renders in BOTH the loading and loaded branches with the same
//     "<page> - <total>" label, so that label is not a loaded-state signal either.
//
// So `await expect(x.first()).toBeVisible()` followed by a separate `await x.count()` or
// `await x.allTextContents()` can straddle a re-render and read 0 / []. Polling the read
// itself is the fix: the value returned is the one that satisfied the check.

import { expect, type Locator } from "@playwright/test";

/**
 * Reads every match's text, retrying until at least one match exists.
 *
 * Use instead of a bare `allTextContents()` whenever the result feeds an assertion --
 * a read that lands during a skeleton re-render returns [] and silently weakens or
 * breaks the comparison that follows.
 */
export async function captureTexts(
  locator: Locator,
  timeout = 15000,
): Promise<string[]> {
  let captured: string[] = [];
  await expect
    .poll(
      async () => {
        captured = await locator.allTextContents();
        return captured.length;
      },
      { timeout },
    )
    .toBeGreaterThan(0);
  return captured;
}
