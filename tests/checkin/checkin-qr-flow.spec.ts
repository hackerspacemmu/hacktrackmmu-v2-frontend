// QR self check-in for regular sessions and the Meet & Greet.
//
// Admin launches a full-screen QR code from the dashboard Control Panel ("Session QR
// Code" or "M&G QR Code"); members open /checkin?token=..., type the exact email they
// registered with, and move to "attended" (session) or "attended_mg" (M&G). Only
// registered/contacted members can check in. There is deliberately no search: the link
// must not let anyone browse the membership list.
//
// Every scenario runs against throwaway fixture members (see support/api.ts) so real
// registered/contacted members are never checked in.
//
// NOTE: failed lookups are rate limited per IP by the backend (20 per 10 minutes, kept
// in the Rails process's memory). These scenarios only make a few failed attempts per
// run; restart the Rails server if you run them many times in a row and start seeing
// "Too many attempts".

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

type CheckInKind = "session" | "meet_and_greet";

async function createCheckInToken(
  kind: CheckInKind = "meet_and_greet",
): Promise<string> {
  const ctx = await request.newContext({ baseURL: API_URL });
  try {
    const login = await ctx.post("/api/v1/login", {
      data: { session: { password: "secretarial slave", remember_me: false } },
    });
    const { token: adminToken } = await login.json();
    const res = await ctx.post("/api/v1/check_ins/session", {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { kind },
    });
    expect(res.status()).toBe(201);
    return (await res.json()).token;
  } finally {
    await ctx.dispose();
  }
}

async function submitEmail(page: Page, email: string) {
  await page.getByRole("textbox", { name: "Your email" }).fill(email);
  await page.getByRole("button", { name: "Check in" }).click();
}

const firstName = (m: MemberFixture) => m.name.split(" ")[0];

test.describe("QR self check-in", () => {
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

  test("admin launches a full-screen M&G QR code from the Control Panel row", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsAdmin(page);

    const launch = page.getByRole("button", { name: "M&G QR Code" });
    await expect(launch).toBeVisible({ timeout: 30000 });

    // Both QR buttons sit in the same row as the other admin buttons on desktop.
    const rowTops = await Promise.all(
      [
        "New Meetup",
        "New Project",
        "New Update",
        "Session QR Code",
        "M&G QR Code",
      ].map(
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
    const sessionRes = await sessionResponse;
    expect(sessionRes.request().postDataJSON()).toEqual({
      kind: "meet_and_greet",
    });
    const session = await sessionRes.json();

    // Codes are valid for one hour.
    const ttlMs = new Date(session.expires_at).getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(58 * 60_000);
    expect(ttlMs).toBeLessThanOrEqual(60 * 60_000);

    const overlay = page.getByTestId("checkin-qr-overlay");
    await expect(overlay).toBeVisible();
    await expect(
      overlay.getByRole("heading", { name: "Meet & Greet Check-in" }),
    ).toBeVisible();
    await expect(overlay).toContainText("Valid until");

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

  test("the projected QR swaps to a new code before the hour is up", async ({
    page,
  }) => {
    await page.clock.install();
    await loginAsAdmin(page);
    await page.getByRole("button", { name: "M&G QR Code" }).click();
    await expect(page.getByTestId("checkin-qr-code")).toBeVisible();

    const refresh = page.waitForRequest(
      (r) =>
        r.url().endsWith("/api/v1/check_ins/session") && r.method() === "POST",
    );
    await page.clock.fastForward("59:30");
    await refresh;
    await expect(page.getByTestId("checkin-qr-code")).toBeVisible();
    await expect(page.getByTestId("checkin-qr-expired")).toHaveCount(0);
  });

  test("an expired QR is hidden when a new code can't be fetched", async ({
    page,
  }) => {
    let calls = 0;
    await page.route("**/api/v1/check_ins/session", (route) => {
      calls += 1;
      return calls === 1
        ? route.fulfill({
            status: 201,
            json: {
              token: "short-lived",
              expires_at: new Date(Date.now() + 90_000).toISOString(),
            },
          })
        : route.fulfill({ status: 401, json: { error: "expired" } });
    });
    await page.clock.install();
    await loginAsAdmin(page);
    await page.getByRole("button", { name: "M&G QR Code" }).click();
    await expect(page.getByTestId("checkin-qr-code")).toBeVisible();

    await page.clock.fastForward("02:00");
    await expect(page.getByTestId("checkin-qr-code")).toHaveCount(0);
    await expect(page.getByTestId("checkin-qr-expired")).toContainText(
      "This QR code has expired",
    );
    await expect(
      page.getByRole("button", { name: "Generate new code" }),
    ).toBeVisible();
  });

  test("scanning the launched QR lets a registered member check in by email", async ({
    page,
    browser,
  }) => {
    const member = await fixture("Checkin Reg", "registered");

    // Launch the QR as the admin and take the token the QR encodes.
    await loginAsAdmin(page);
    const sessionResponse = page.waitForResponse((r) =>
      r.url().endsWith("/api/v1/check_ins/session"),
    );
    await page.getByRole("button", { name: "M&G QR Code" }).click();
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

      // No search UI at all.
      await expect(m.getByRole("combobox")).toHaveCount(0);
      await expect(m.getByRole("listbox")).toHaveCount(0);

      await submitEmail(m, member.email);
      await expect(
        m.getByRole("heading", {
          name: `You're checked in, ${firstName(member)}!`,
        }),
      ).toBeVisible();
      // Only the first name comes back, never the full name.
      await expect(m.getByText(member.name)).toHaveCount(0);
    } finally {
      await phone.close();
    }

    expect((await getMemberById(member.id))?.status).toBe("attended_mg");
  });

  test("scanning the Session QR moves a registered member to Attended", async ({
    page,
    browser,
  }) => {
    const member = await fixture("Checkin Session", "registered");

    await loginAsAdmin(page);
    const sessionResponse = page.waitForResponse((r) =>
      r.url().endsWith("/api/v1/check_ins/session"),
    );
    await page.getByRole("button", { name: "Session QR Code" }).click();
    const sessionRes = await sessionResponse;
    expect(sessionRes.request().postDataJSON()).toEqual({ kind: "session" });
    const { token } = await sessionRes.json();
    await expect(
      page
        .getByTestId("checkin-qr-overlay")
        .getByRole("heading", { name: "Session Check-in" }),
    ).toBeVisible();

    const phone = await browser.newContext({ ...devices["iPhone 13"] });
    const m = await phone.newPage();
    try {
      await m.goto(`/checkin?token=${encodeURIComponent(token)}`);
      await expect(
        m.getByRole("heading", { name: "Session Check-in" }),
      ).toBeVisible();
      await submitEmail(m, member.email);
      await expect(
        m.getByRole("heading", {
          name: `You're checked in, ${firstName(member)}!`,
        }),
      ).toBeVisible();
      await expect(m.getByText("Welcome to today's session.")).toBeVisible();
    } finally {
      await phone.close();
    }

    expect((await getMemberById(member.id))?.status).toBe("attended");
  });

  test("members can't use the other event's QR once checked in", async ({
    page,
  }) => {
    const attended = await fixture("Checkin Attended", "attended");
    const attendedMg = await fixture("Checkin AttendedMG", "attended_mg");

    // Attended (session) member scanning the M&G QR.
    await page.goto(
      `/checkin?token=${encodeURIComponent(await createCheckInToken("meet_and_greet"))}`,
    );
    await submitEmail(page, attended.email);
    await expect(
      page.getByText(/can't be used to check in for the Meet & Greet/),
    ).toBeVisible({ timeout: 10000 });

    // Attended M&G member scanning the Session QR.
    await page.goto(
      `/checkin?token=${encodeURIComponent(await createCheckInToken("session"))}`,
    );
    await submitEmail(page, attendedMg.email);
    await expect(
      page.getByText(/can't be used to check in for today's session/),
    ).toBeVisible({ timeout: 10000 });

    expect((await getMemberById(attended.id))?.status).toBe("attended");
    expect((await getMemberById(attendedMg.id))?.status).toBe("attended_mg");
  });

  test("contacted members can check in; email case doesn't matter", async ({
    page,
  }) => {
    const contacted = await fixture("Checkin Con", "contacted");
    const token = await createCheckInToken();

    await page.goto(`/checkin?token=${encodeURIComponent(token)}`);
    await submitEmail(page, `  ${contacted.email.toUpperCase()} `);
    await expect(
      page.getByRole("heading", { name: /You're checked in/ }),
    ).toBeVisible({ timeout: 10000 });

    expect((await getMemberById(contacted.id))?.status).toBe("attended_mg");
  });

  test("names and partial emails don't check anyone in", async ({ page }) => {
    const member = await fixture("Checkin Partial", "registered");
    const token = await createCheckInToken();
    await page.goto(`/checkin?token=${encodeURIComponent(token)}`);

    // A name is not an email.
    await submitEmail(page, member.name);
    await expect(
      page.getByText("Please enter a valid email address."),
    ).toBeVisible({
      timeout: 10000,
    });

    // Missing the last character of the TLD.
    await submitEmail(page, member.email.slice(0, -1));
    await expect(page.getByText(EMAIL_NOT_FOUND)).toBeVisible({
      timeout: 10000,
    });

    expect((await getMemberById(member.id))?.status).toBe("registered");
  });

  test("an email that isn't registered shows the not-registered message", async ({
    page,
  }) => {
    const token = await createCheckInToken();
    await page.goto(`/checkin?token=${encodeURIComponent(token)}`);

    await submitEmail(page, `nobody-${Date.now()}@nowhere.invalid`);
    await expect(page.getByText(EMAIL_NOT_FOUND)).toBeVisible({
      timeout: 10000,
    });
  });

  test("members past onboarding can't use the check-in", async ({ page }) => {
    const active = await fixture("Checkin Act", "active");
    const token = await createCheckInToken();
    await page.goto(`/checkin?token=${encodeURIComponent(token)}`);

    await submitEmail(page, active.email);
    await expect(
      page.getByText(/can't be used to check in for the Meet & Greet/),
    ).toBeVisible({ timeout: 10000 });
    expect((await getMemberById(active.id))?.status).toBe("active");
  });

  test("an invalid or missing token is rejected", async ({ page }) => {
    await page.goto("/checkin?token=not-a-real-token");
    await expect(
      page.getByRole("heading", { name: "QR code not valid" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("textbox", { name: "Your email" })).toHaveCount(
      0,
    );

    await page.goto("/checkin");
    await expect(
      page.getByRole("heading", { name: "QR code not valid" }),
    ).toBeVisible({ timeout: 10000 });
  });
});
