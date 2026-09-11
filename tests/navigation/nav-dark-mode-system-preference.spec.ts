// spec: specs/hacktrack-e2e.plan.md
// seed: seed.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Navigation & Layout", () => {
  test("Dark mode follows the OS/browser prefers-color-scheme setting", async ({
    page,
  }) => {
    // The login column carries the static class pair `bg-white dark:bg-[#111]`, so the
    // class attribute is identical in both themes and proves nothing on its own. Tailwind
    // is on its default `media` dark strategy (no darkMode key in tailwind.config.ts), so
    // which half of that pair wins is decided by the emulated colour scheme -- assert the
    // resolved background colour instead of the class list.
    const loginColumn = page.locator("div.bg-white.dark\\:bg-\\[\\#111\\]");
    // Both logo variants are rendered with the same alt text, one or the other depending
    // on useDarkMode, so the src is what distinguishes them. next/image may rewrite the
    // src into a /_next/image?url=... form, and the plain `hackerspaceLogo.svg` pattern
    // still discriminates because the dark variant's filename is hackerspaceLogoWhite.svg.
    const logo = page.getByRole("img", { name: "Hacktrack MMU" });

    // 1. Emulate color-scheme: light and navigate to /login
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/login");

    // expect: Page renders with light-theme classes/background (bg-white) and the
    // standard (non-white) hackerspace logo
    await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible({
      timeout: 15000,
    });
    await expect(loginColumn).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    await expect(logo).toHaveAttribute("src", /hackerspaceLogo\.svg/);

    // 2. Emulate color-scheme: dark and reload /login
    await page.emulateMedia({ colorScheme: "dark" });
    await page.reload();

    // expect: Page renders with dark-theme classes/background (dark:bg-[#111]) and the
    // white logo variant (hackerspaceLogoWhite.svg)
    await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible({
      timeout: 15000,
    });
    await expect(loginColumn).toHaveCSS("background-color", "rgb(17, 17, 17)");
    // useDarkMode sets its state from window.matchMedia in an effect, so the logo swap
    // lands a tick after first paint -- the retrying assertion covers that.
    await expect(logo).toHaveAttribute("src", /hackerspaceLogoWhite\.svg/);

    // expect: Confirm there is no manual sun/moon toggle button anywhere in the UI --
    // dark mode is purely automatic
    // useDarkMode does expose a `toggle()` function, but no component calls it; these two
    // checks assert that absence from the rendered UI rather than from the source. The
    // icon check covers lucide's Sun/Moon glyphs (rendered as svg.lucide-sun /
    // svg.lucide-moon), the role check covers a text-labelled control.
    await expect(page.locator("svg.lucide-sun, svg.lucide-moon")).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: /dark|light|theme|sun|moon/i }),
    ).toHaveCount(0);

    // The same holds on an authenticated page, where the nav bar renders its own
    // theme-dependent logo -- so the absence of a toggle is not just a login-page trait.
    await page
      .getByRole("textbox", { name: "Password" })
      .fill("secretarial slave");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
    await expect(page.locator("svg.lucide-sun, svg.lucide-moon")).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: /dark|light|theme|sun|moon/i }),
    ).toHaveCount(0);
    // The nav logo follows the same preference: white variant under the dark scheme.
    await expect(
      page.getByRole("navigation").first().getByRole("img", { name: "logo" }),
    ).toHaveAttribute("src", /hackerspaceLogoWhite\.svg/);
  });
});
