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
  /**
   * Only populated by getMemberById, which returns the member record as the API stores
   * it. createMember does not return it -- POST /api/v1/members answers with just
   * `{ message, uuid }`, and the follow-up search lookup is only used to recover the id.
   * Read it when a scenario needs to prove a status write did (or did not) land.
   */
  status?: string;
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

// ---------------------------------------------------------------------------
// Meetup fixtures (section 4)
// ---------------------------------------------------------------------------

export interface ProjectFixture {
  id: number;
  name: string;
}

export interface UpdateFixture {
  id: number;
  description: string;
}

export interface MeetupFixture {
  id: number;
  number: number;
  date: string;
  /** The meetup's host. A fixture member, never a seeded one -- see createMeetupFixture. */
  host: MemberFixture;
  /** Only present when the fixture was created `withUpdate`. */
  project: ProjectFixture | null;
  /** Only present when the fixture was created `withUpdate`. */
  update: UpdateFixture | null;
}

/**
 * Builds a short, collision-resistant fixture tag.
 *
 * Deliberately short: MeetupCard truncates an update's project name and author name to
 * `slice(0, 40) + "..."` when either exceeds 40 characters. A long fixture name would
 * therefore render truncated in the meetup modal, forcing every spec that asserts on
 * those strings to re-implement the component's cutoff. Keeping tags well under 40
 * characters means what the fixture stores is exactly what the UI shows.
 *
 * Entropy comes from a base36 millisecond stamp plus four random base36 characters
 * (~1.7M combinations), so two workers creating a fixture in the same millisecond still
 * get distinct names -- which matters because fixtures are looked up by exact name.
 */
function shortFixtureTag(prefix: string, label: string, workerIndex: number): string {
  const slug = label.replace(/[^A-Za-z0-9]/g, "").slice(0, 8);
  const stamp = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 1679616)
    .toString(36)
    .padStart(4, "0");
  return `E2E ${prefix}${slug} ${workerIndex}-${stamp}-${rand}`;
}

/**
 * Base of this worker's reserved meetup-number band.
 *
 * `meetups.number` is a UNIQUE index, so workers that each ask the app for "the next
 * meetup number" collide. Each worker instead owns the hundred numbers starting here,
 * far above any real meetup (the app is in the 400s), and createMeetupFixture walks that
 * band until it finds a free slot.
 */
function reservedNumberBase(workerIndex: number): number {
  return 90000 + workerIndex * 100;
}

/**
 * Looks a meetup up by its number.
 *
 * The meetups index is ordered by `id` DESC -- newest first -- NOT by number and NOT by
 * date. Verified against the running backend: page 1 reads
 * `495(id 2959), 494(2958), 493(2925), 492(2892), 491(2860), 488(2827), 490(2826), ...`,
 * where 488 sits ahead of 490 because it was created later despite its lower number and
 * earlier date. A freshly created fixture therefore always holds the newest id and lands
 * first on page 1, whatever number or date it was given.
 *
 * `GET /api/v1/meetups/search?query=` is NOT usable here -- it does not match on meetup
 * number and returns [] for a number that exists.
 */
export async function findMeetupByNumber(
  meetupNumber: number,
): Promise<{ id: number; number: number; date: string; updates: UpdateFixture[] } | null> {
  return withAdminApi(async (api) => {
    const res = await api.get("/api/v1/meetups/", { params: { page: 1 } });
    if (!res.ok()) return null;
    const body = await res.json();
    const regular = body?.data?.regular_meetups ?? [];
    const match = regular.find(
      (m: { number?: number }) => m?.number === meetupNumber,
    );
    if (!match) return null;
    return {
      id: match.id,
      number: match.number,
      date: match.date,
      updates: (match.updates ?? []).map(
        (u: { id: number; description: string }) => ({
          id: u.id,
          description: u.description,
        }),
      ),
    };
  });
}

/**
 * Creates a self-contained meetup fixture: its own host member, and optionally its own
 * project plus one update attached to the meetup.
 *
 * The host is a freshly created member rather than a seeded one on purpose. Assigning a
 * seeded member as host permanently promotes them out of the app's finite "Yet To Host"
 * pool for as long as the meetup exists, which is exactly the shared-state corruption
 * section 4's isolation rule exists to prevent.
 *
 * The meetup number is taken from this worker's reserved band. A duplicate number answers
 * 422 "Number has already been taken", so a collision (a repeat run, or a fixture that
 * outlived its test) just advances to the next slot instead of failing the test.
 */
export async function createMeetupFixture(options: {
  label: string;
  workerIndex?: number;
  date?: string;
  withUpdate?: boolean;
}): Promise<MeetupFixture> {
  const workerIndex = options.workerIndex ?? 0;
  const date = options.date ?? "2020-01-15";

  const host = await createMember({
    name: shortFixtureTag("H", options.label, workerIndex),
    status: "active",
  });

  return withAdminApi(async (api) => {
    // Walk this worker's reserved band for a free number.
    const base = reservedNumberBase(workerIndex);
    let created: { id: number; number: number } | null = null;
    let lastError = "";

    for (let n = 1; n <= 99 && !created; n++) {
      const meetupNumber = base + n;
      const res = await api.post("/api/v1/meetups", {
        data: {
          meetup: {
            number: meetupNumber,
            date,
            category: "regular_meetup",
            host_id: host.id,
          },
        },
      });

      if (res.ok()) {
        const found = await findMeetupByNumber(meetupNumber);
        if (!found) {
          throw new Error(
            `[fixture] meetup ${meetupNumber} was created but not found on page 1`,
          );
        }
        created = { id: found.id, number: meetupNumber };
        break;
      }

      lastError = `${res.status()}: ${await res.text()}`;
      // 422 "Number has already been taken" is the only retryable outcome.
      if (res.status() !== 422) break;
    }

    if (!created) {
      throw new Error(
        `[fixture] could not create a meetup in band ${base}+1..99 (last error ${lastError})`,
      );
    }

    let project: ProjectFixture | null = null;
    let update: UpdateFixture | null = null;

    if (options.withUpdate) {
      const projectName = shortFixtureTag("P", options.label, workerIndex);
      const projectRes = await api.post("/api/v1/projects", {
        data: {
          project: {
            name: projectName,
            category: "project",
            completed: false,
            member_ids: [host.id],
          },
        },
      });
      if (!projectRes.ok()) {
        throw new Error(
          `[fixture] POST /api/v1/projects failed (${projectRes.status()}): ${await projectRes.text()}`,
        );
      }
      const projectsRes = await api.get("/api/v1/projects");
      const projects = await projectsRes.json();
      const foundProject = (Array.isArray(projects) ? projects : []).find(
        (p: { name?: string }) => p?.name === projectName,
      );
      if (!foundProject?.id) {
        throw new Error(`[fixture] created project "${projectName}" was not found`);
      }
      project = { id: foundProject.id, name: foundProject.name };

      const description = `E2E ${options.label} update ${workerIndex}-${Date.now()}`;
      const updateRes = await api.post("/api/v1/updates", {
        data: {
          update: {
            meetup_id: created.id,
            member_id: host.id,
            project_id: project.id,
            category: "idea_talk",
            description,
          },
        },
      });
      if (!updateRes.ok()) {
        throw new Error(
          `[fixture] POST /api/v1/updates failed (${updateRes.status()}): ${await updateRes.text()}`,
        );
      }
      // POST /api/v1/updates returns only a message, and there is no updates index route,
      // so the id is recovered from the meetup's own nested payload.
      const withUpdates = await findMeetupByNumber(created.number);
      const foundUpdate = (withUpdates?.updates ?? []).find(
        (u) => u.description === description,
      );
      if (!foundUpdate?.id) {
        throw new Error(`[fixture] created update "${description}" was not found`);
      }
      update = { id: foundUpdate.id, description };
    }

    return {
      id: created.id,
      number: created.number,
      date,
      host,
      project,
      update,
    };
  });
}

/**
 * Removes everything createMeetupFixture made, in dependency order: the meetup (its
 * updates cascade via `Meetup has_many :updates, dependent: :destroy`), then the project,
 * then the host member.
 *
 * Every step tolerates the record already being gone -- the delete-confirmation scenarios
 * may legitimately have removed the meetup themselves. The meetup and project deletes are
 * guarded by a lookup first, because both answer 500 rather than 404 for an id that no
 * longer exists (verified against the running backend); firing them blind would turn a
 * clean teardown into a spurious warning. Deleting a missing member does answer 404, so
 * that one is safe to attempt directly.
 */
export async function destroyMeetupFixture(
  fixture: MeetupFixture,
): Promise<boolean> {
  const meetup = await findMeetupByNumber(fixture.number);

  return withAdminApi(async (api) => {
    let ok = true;

    // The meetup goes first so its updates cascade before the project they point at.
    if (meetup) {
      ok = (await api.delete(`/api/v1/meetups/${meetup.id}`)).ok() && ok;
    }

    if (fixture.project) {
      const listRes = await api.get("/api/v1/projects");
      const projects = listRes.ok() ? await listRes.json() : [];
      const stillThere = (Array.isArray(projects) ? projects : []).some(
        (p: { id?: number }) => p?.id === fixture.project!.id,
      );
      if (stillThere) {
        ok = (await api.delete(`/api/v1/projects/${fixture.project.id}`)).ok() && ok;
      }
    }

    const memberRes = await api.delete(`/api/v1/members/${fixture.host.id}`);
    ok = (memberRes.ok() || memberRes.status() === 404) && ok;

    return ok;
  });
}
