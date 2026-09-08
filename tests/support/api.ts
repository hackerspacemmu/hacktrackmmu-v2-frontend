// Test-data teardown helpers.
//
// The three Dashboard happy-path specs deliberately create real records through the UI --
// that is the behaviour under test -- so each one must remove what it created afterwards.
// Left uncleaned they are destructive in a compounding way: every New Meetup run promotes
// one member from the finite "Yet To Host" pool into "Have Hosted" permanently, and the
// next-meetup-number counter climbs for good.
//
// Cleanup has to LOOK UP what it deletes, because POST /api/v1/meetups, /projects and
// /updates all return only `{ message }` with no id. Each spec therefore tags its record
// with a value it knows (a captured meetup number, or a timestamped name/description) and
// hands that back here.

import { request } from "@playwright/test";

// The Rails API is a different origin from the app under test (which is on baseURL).
const API_URL = process.env.HACKTRACK_API_URL ?? "http://localhost:3000";
const ADMIN_PASSWORD = "secretarial slave";

async function withAdminApi<T>(
  fn: (ctx: Awaited<ReturnType<typeof request.newContext>>) => Promise<T>,
): Promise<T> {
  const ctx = await request.newContext({ baseURL: API_URL });
  try {
    const loginRes = await ctx.post("/api/v1/login", {
      data: { session: { password: ADMIN_PASSWORD, remember_me: false } },
    });
    const { token } = await loginRes.json();
    const authed = await request.newContext({
      baseURL: API_URL,
      extraHTTPHeaders: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    try {
      return await fn(authed);
    } finally {
      await authed.dispose();
    }
  } finally {
    await ctx.dispose();
  }
}

/**
 * Deletes the regular meetup with the given number. Its updates cascade
 * (Meetup has_many :updates, dependent: :destroy), and removing it also returns the
 * host to "Yet To Host" and rolls the next-meetup-number counter back.
 */
export async function deleteMeetupByNumber(
  meetupNumber: string | number,
): Promise<boolean> {
  return withAdminApi(async (api) => {
    const res = await api.get("/api/v1/dashboard/meetups");
    if (!res.ok()) return false;
    const meetups = await res.json();
    const match = (Array.isArray(meetups) ? meetups : []).find(
      (m: { number?: number }) => String(m?.number) === String(meetupNumber),
    );
    if (!match?.id) return false;
    return (await api.delete(`/api/v1/meetups/${match.id}`)).ok();
  });
}

/** Deletes the project with this exact name. Its updates cascade. */
export async function deleteProjectByName(name: string): Promise<boolean> {
  return withAdminApi(async (api) => {
    const res = await api.get("/api/v1/projects");
    if (!res.ok()) return false;
    const projects = await res.json();
    const match = (Array.isArray(projects) ? projects : []).find(
      (p: { name?: string }) => p?.name === name,
    );
    if (!match?.id) return false;
    return (await api.delete(`/api/v1/projects/${match.id}`)).ok();
  });
}

/**
 * Deletes the update with this exact description.
 *
 * There is no GET /api/v1/updates index route, so the update cannot be looked up
 * directly. It is instead found nested inside the dashboard's recent-meetups payload,
 * which is where a freshly created update always lands.
 */
export async function deleteUpdateByDescription(
  description: string,
): Promise<boolean> {
  return withAdminApi(async (api) => {
    const res = await api.get("/api/v1/dashboard/meetups");
    if (!res.ok()) return false;
    const meetups = await res.json();
    for (const meetup of Array.isArray(meetups) ? meetups : []) {
      const match = (meetup?.updates ?? []).find(
        (u: { description?: string }) => u?.description === description,
      );
      if (match?.id) {
        return (await api.delete(`/api/v1/updates/${match.id}`)).ok();
      }
    }
    return false;
  });
}

/**
 * Runs a cleanup step without letting its failure mask the test result. A teardown that
 * throws would replace a real assertion failure with a confusing cleanup error, so
 * problems are surfaced as a warning instead.
 */
export async function cleanUp(
  label: string,
  fn: () => Promise<boolean>,
): Promise<void> {
  try {
    const removed = await fn();
    if (!removed) {
      console.warn(`[cleanup] could not find ${label} to delete`);
    }
  } catch (error) {
    console.warn(`[cleanup] failed to delete ${label}:`, error);
  }
}

// ---------------------------------------------------------------------------
// Member fixtures (section 3 onward)
// ---------------------------------------------------------------------------

export interface MemberFixture {
  id: number;
  name: string;
  email: string;
}

/**
 * Builds a member name that no other worker -- and no seeded record -- can collide with.
 *
 * Fixtures are looked up by name (see createMember), and section 3 forbids selecting
 * shared data by position, so the name doubles as the fixture's handle. Pass
 * `test.info().workerIndex` so two workers running the same spec cannot generate the
 * same tag inside the same millisecond.
 */
export function uniqueMemberName(label: string, workerIndex = 0): string {
  return `E2E ${label} ${workerIndex}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
}

/**
 * Creates a member through the REST API and returns it with its database id.
 *
 * POST /api/v1/members answers with only `{ message, uuid }` -- no id -- so the id has to
 * be recovered afterwards. GET /api/v1/members/search?query=<name> returns a flat array
 * of full member records (not the `{data, meta}` envelope the /filtered route uses), and
 * a name built by uniqueMemberName matches exactly one of them.
 *
 * `status` defaults to "active" so the fixture shows up under the /members page's default
 * Active/Socially Active filter. Onboarding scenarios should pass "registered",
 * "contacted" or "first_talk_given" instead.
 */
export async function createMember(
  attributes: {
    name: string;
    email?: string;
    status?: string;
    contact_number?: string;
    comment?: string;
    student_id?: string;
    discord_tag?: string;
    other_info?: Record<string, string>;
  },
): Promise<MemberFixture> {
  const member = {
    status: "active",
    email: `${attributes.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}@e2e.invalid`,
    ...attributes,
  };

  return withAdminApi(async (api) => {
    const createRes = await api.post("/api/v1/members", { data: { member } });
    if (!createRes.ok()) {
      throw new Error(
        `[fixture] POST /api/v1/members failed (${createRes.status()}): ${await createRes.text()}`,
      );
    }

    const searchRes = await api.get("/api/v1/members/search", {
      params: { query: member.name },
    });
    if (!searchRes.ok()) {
      throw new Error(
        `[fixture] member lookup failed (${searchRes.status()}) for "${member.name}"`,
      );
    }

    const matches = await searchRes.json();
    const created = (Array.isArray(matches) ? matches : []).find(
      (m: { name?: string }) => m?.name === member.name,
    );
    if (!created?.id) {
      throw new Error(`[fixture] created member "${member.name}" was not found by search`);
    }

    return { id: created.id, name: created.name, email: created.email };
  });
}

/**
 * Deletes a fixture member by id.
 *
 * A 404 counts as success: the only thing teardown cares about is that the record is gone,
 * and the delete-confirmation scenarios may legitimately have removed it already.
 */
export async function deleteMemberById(id: number): Promise<boolean> {
  return withAdminApi(async (api) => {
    const res = await api.delete(`/api/v1/members/${id}`);
    return res.ok() || res.status() === 404;
  });
}

/**
 * Reads a member back through the REST API.
 *
 * Used by validation scenarios to prove the stored record is untouched, rather than
 * inferring it from the absence of a PATCH request on the wire.
 *
 * Note the backend quirk documented in the plan: GET for a non-existent id answers 200
 * with a null body rather than 404, so a null return means "no such member".
 */
export async function getMemberById(id: number): Promise<MemberFixture | null> {
  return withAdminApi(async (api) => {
    const res = await api.get(`/api/v1/members/${id}`);
    if (!res.ok()) return null;
    return (await res.json()) as MemberFixture | null;
  });
}
