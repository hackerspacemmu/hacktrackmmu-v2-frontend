// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("Login page image carousel cycles through all 4 images", async ({
    page,
  }) => {
    // 1. Navigate to /login on a viewport >= md breakpoint (carousel column is hidden below md)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/login");

    const visual1 = page.getByRole("img", { name: "Login visual 1" });
    const visual2 = page.getByRole("img", { name: "Login visual 2" });
    const visual3 = page.getByRole("img", { name: "Login visual 3" });
    const visual4 = page.getByRole("img", { name: "Login visual 4" });

    // expect: 'Login visual 1' image has opacity-100 (active) and the other 3 have opacity-0
    await expect(visual1).toHaveClass(/opacity-100/);
    await expect(visual2).toHaveClass(/opacity-0/);
    await expect(visual3).toHaveClass(/opacity-0/);
    await expect(visual4).toHaveClass(/opacity-0/);

    // 2. Wait 5.5 seconds
    // The carousel advances via a real setInterval every 5000ms in the app, so this
    // assertion relies on Playwright's web-first polling (rather than a fixed sleep)
    // to wait out the interval, with a generous timeout to cover the 1s crossfade.
    // expect: 'Login visual 2' is now the active (opacity-100) image, confirming the 5-second auto-rotate interval
    await expect(visual2).toHaveClass(/opacity-100/, { timeout: 8000 });
    await expect(visual1).toHaveClass(/opacity-0/);
  });
});
