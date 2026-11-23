// Meet & Greet QR self check-in.
//
// Admin launches a full-screen QR code from the dashboard Control Panel; members open
// /checkin?token=..., search for themselves, confirm, and move to "attended_mg".
//
// Every scenario runs against throwaway fixture members (see support/api.ts) so real
// registered/contacted members are never checked in.

import { test, expect, request, devices, type Page } from "@playwright/test";
import {
  cleanUp,
  createMember,
  deleteMemberById,
  getMemberById,
  uniqueMemberName,
  type MemberFixture,
} from "../support/api";

const API_URL = process.env.HACKTRACK_API_URL ?? "http://localhost:3000";
const EMAIL_NOT_FOUND =
  "This email doesn't exist, are you sure you registered with this email?";

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page
    .getByRole("textbox", { name: "Password" })
    .fill("secretarial slave");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
}

async function createCheckInToken(): Promise<string> {
  const ctx = await request.newContext({ baseURL: API_URL });
  try {
    const login = await ctx.post("/api/v1/login", {
      data: { session: { password: "secretarial slave", remember_me: false } },
    });
    const { token: adminToken } = await login.json();
    const res = await ctx.post("/api/v1/check_ins/session", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(201);
    return (await res.json()).token;
  } finally {
    await ctx.dispose();
  }
}

test.describe("Meet & Greet check-in", () => {
  const created: MemberFixture[] = [];

  test.afterEach(async () => {
    while (created.length) {
      const m = created.pop()!;
      await cleanUp(`member ${m.id}`, () => deleteMemberById(m.id));
    }
  });

  async function fixture(label: string, status: string) {
    const m = await createMember({
      name: uniqueMemberName(label, test.info().workerIndex),
      status,
    });
    created.push(m);
    return m;
  }

  test("admin launches a full-screen QR code from the Control Panel row", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsAdmin(page);

    const launch = page.getByRole("button", { name: "Launch QR Code" });
    await expect(launch).toBeVisible({ timeout: 30000 });

    // Same row as the other admin buttons on desktop.
    const rowTops = await Promise.all(
      ["New Meetup", "New Project", "New Update", "Launch QR Code"].map(
        async (name) =>
          (await page.getByRole("button", { name }).boundingBox())!.y,
      ),
    );
    expect(new Set(rowTops.map(Math.round)).size).toBe(1);

    const sessionResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/v1/check_ins/session") &&
        r.request().method() === "POST",
    );
    await launch.click();
    expect((await sessionResponse).status()).toBe(201);

    const overlay = page.getByTestId("checkin-qr-overlay");
    await expect(overlay).toBeVisible();
    await expect(
      overlay.getByRole("heading", { name: "Meet & Greet Check-in" }),
    ).toBeVisible();

    // Overlay covers the whole viewport and the QR dominates it.
    const overlayBox = (await overlay.boundingBox())!;
    expect(overlayBox.width).toBe(1440);
    expect(overlayBox.height).toBe(900);
    const qrBox = (await page.getByTestId("checkin-qr-code").boundingBox())!;
    expect(qrBox.height).toBeGreaterThan(900 * 0.5);

    await page.keyboard.press("Escape");
    await expect(overlay).toBeHidden();

    await launch.click();
    await expect(overlay).toBeVisible();
    await page.getByRole("button", { name: "Close QR code" }).click();
    await expect(overlay).toBeHidden();
  });

  test("scanning the launched QR lets a registered member check in", async ({
    page,
    browser,
  }) => {
    const member = await fixture("Checkin Reg", "registered");

    // Launch the QR as the admin and take the token the QR encodes.
    await loginAsAdmin(page);
    const sessionResponse = page.waitForResponse((r) =>
      r.url().endsWith("/api/v1/check_ins/session"),
    );
    await page.getByRole("button", { name: "Launch QR Code" }).click();
    const { token } = await (await sessionResponse).json();

    // Member's phone: a fresh, signed-out context.
    const phone = await browser.newContext({ ...devices["iPhone 13"] });
    const m = await phone.newPage();
    try {
      await m.goto(`/checkin?token=${encodeURIComponent(token)}`);
      await expect(
        m.getByRole("heading", { name: "Meet & Greet Check-in" }),
      ).toBeVisible();
      // Not bounced to /login despite having no session.
      await m.waitForTimeout(1000);
      await expect(m).toHaveURL(/\/checkin\?token=/);

      const search = m.getByRole("combobox");
      await search.fill(member.name.split(" ").slice(1, 3).join(" ")); // partial name
      const option = m.getByRole("option", { name: new RegExp(member.name) });
      await expect(option).toBeVisible({ timeout: 10000 });
      // Email shown masked, never in full.
      await expect(option).toContainText("@e2e.invalid");
      await expect(option).not.toContainText(member.email);

      await option.click();
      await expect(m.getByText("Checking in as")).toBeVisible();
      await m.getByRole("button", { name: "Confirm" }).click();

      await expect(
        m.getByRole("heading", { name: `You're checked in, ${member.name}!` }),
      ).toBeVisible();
    } finally {
      await phone.close();
    }

    expect((await getMemberById(member.id))?.status).toBe("attended_mg");
  });

  test("contacted members can check in; other statuses are not listed", async ({
    page,
  }) => {
    const contacted = await fixture("Checkin Con", "contacted");
    const active = await fixture("Checkin Act", "active");
    const token = await createCheckInToken();

    await page.goto(`/checkin?token=${encodeURIComponent(token)}`);
    const search = page.getByRole("combobox");

    // Active member: nothing to pick, so the not-registered message shows.
    await search.fill(active.name);
    await expect(page.getByText(EMAIL_NOT_FOUND)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("option")).toHaveCount(0);

    // Contacted member, found by exact email.
    await search.fill(contacted.email);
    await page
      .getByRole("option", { name: new RegExp(contacted.name) })
      .click();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(
      page.getByRole("heading", { name: /You're checked in/ }),
    ).toBeVisible();

    expect((await getMemberById(contacted.id))?.status).toBe("attended_mg");
    expect((await getMemberById(active.id))?.status).toBe("active");
  });

  test("an unknown email shows the not-registered message", async ({
    page,
  }) => {
    const token = await createCheckInToken();
    await page.goto(`/checkin?token=${encodeURIComponent(token)}`);

    await page
      .getByRole("combobox")
      .fill(`nobody-${Date.now()}@nowhere.invalid`);
    await expect(page.getByText(EMAIL_NOT_FOUND)).toBeVisible({
      timeout: 10000,
    });
  });

  test("'My email isn't listed' shows the not-registered message", async ({
    page,
  }) => {
    const member = await fixture("Checkin Unlisted", "registered");
    const token = await createCheckInToken();
    await page.goto(`/checkin?token=${encodeURIComponent(token)}`);

    await page.getByRole("combobox").fill(member.name);
    await expect(
      page.getByRole("option", { name: new RegExp(member.name) }),
    ).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "My email isn't listed" }).click();
    await expect(page.getByText(EMAIL_NOT_FOUND)).toBeVisible();
  });

  test("an invalid or missing token is rejected", async ({ page }) => {
    await page.goto("/checkin?token=not-a-real-token");
    await expect(
      page.getByRole("heading", { name: "QR code not valid" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("combobox")).toHaveCount(0);

    await page.goto("/checkin");
    await expect(
      page.getByRole("heading", { name: "QR code not valid" }),
    ).toBeVisible({ timeout: 10000 });
  });
});
