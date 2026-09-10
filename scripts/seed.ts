/**
 * Layers known, idempotent test data onto a running ReCodEx instance via the
 * public API only (never SQL) -- see docs/DECISIONS.md and nextjs-frontend-agent-brief.md
 * "Build scripts/seed.ts in the first session, before any UI work" for the full spec this
 * implements. Run with `pnpm seed`.
 *
 * Every entity this script creates is named/tagged with SEED_PREFIX and looked up before
 * creating, so re-running it against its own previous output does not duplicate anything.
 * Wiping the database is an operator-level `docker compose down -v && up -d` action, not
 * something this script does or assumes -- see docs/SEED_ACCOUNTS.md for how to reset.
 */

import { crc32 } from "node:zlib";

const API_BASE = process.env.API_BASE_INTERNAL ?? process.env.API_BASE_PUBLIC;
if (!API_BASE) {
  throw new Error("API_BASE_INTERNAL or API_BASE_PUBLIC must be set (see .env.local).");
}

const SEED_PREFIX = "[seed]";
// Not a secret -- disposable test data on a disposable instance, see docs/SEED_ACCOUNTS.md.
const SEED_PASSWORD = "RecodexSeed123!";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@admin.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin";
const FILLER_COUNT = 25; // comfortably past any plausible page size, for pagination states

// ---------------------------------------------------------------------------
// Minimal API client -- only the fields this script actually reads are typed.
// ---------------------------------------------------------------------------

class ApiError extends Error {}

async function api<T>(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: string | undefined;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${API_BASE}${path}`, { method, headers, body });
  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new ApiError(
      `${method} ${path} -> ${res.status}: ${json?.error?.message ?? JSON.stringify(json)}`,
    );
  }
  return json.payload as T;
}

async function apiUpload(
  token: string,
  path: string,
  filename: string,
  content: string | Uint8Array<ArrayBuffer>,
  mimeType = "text/plain",
): Promise<{ id: string }> {
  const form = new FormData();
  form.append("file", new Blob([content], { type: mimeType }), filename);
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new ApiError(
      `POST ${path} (upload) -> ${res.status}: ${json?.error?.message ?? JSON.stringify(json)}`,
    );
  }
  return json.payload as { id: string };
}

/**
 * A ZIP archive with no compression (method 0), written by hand.
 *
 * Node ships no ZIP writer and shelling out to `zip(1)` would make this script depend on a tool
 * the operator's machine may not have -- portability that a previous review pass already asked
 * for once. Stored entries need no deflate, so the whole format here is: a local header per file,
 * a central directory, and the end-of-directory record. core-api accepts it as a real archive
 * (`isZipArchive()`), which is the whole point: a solution submitted as a single ZIP is stored as
 * a `SolutionZipFile` and is the only way to produce the `zipEntries` the source viewer (S-017)
 * expands.
 */
function storedZip(entries: [name: string, content: string][]): Uint8Array<ArrayBuffer> {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const [name, content] of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const data = Buffer.from(content, "utf8");
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    parts.push(local, nameBuf, data);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4); // version made by
    entry.writeUInt16LE(20, 6); // version needed
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBuf.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBuf);

    offset += local.length + nameBuf.length + data.length;
  }

  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...parts, directory, end]);
}

function log(msg: string) {
  console.log(`${SEED_PREFIX} ${msg}`);
}

// ---------------------------------------------------------------------------
// Auth / users
// ---------------------------------------------------------------------------

interface AuthResult {
  token: string;
  userId: string;
}

async function login(email: string, password: string): Promise<AuthResult> {
  const payload = await api<{ accessToken: string; user: { id: string } }>("POST", "/login", {
    body: { username: email, password },
  });
  return { token: payload.accessToken, userId: payload.user.id };
}

interface SeedUserSpec {
  email: string;
  firstName: string;
  lastName: string;
  role?: "student" | "supervisor-student" | "supervisor" | "empowered-supervisor" | "superadmin";
}

/** Login if the account already exists (idempotent path), else register it fresh. */
async function getOrCreateUser(
  adminToken: string,
  instanceId: string,
  spec: SeedUserSpec,
): Promise<AuthResult> {
  try {
    const existing = await login(spec.email, SEED_PASSWORD);
    log(`user exists, reused: ${spec.email}`);
    return existing;
  } catch {
    // Not found / wrong credentials -- assume it doesn't exist yet and register it.
  }

  // LOCAL_REGISTRATION_ENABLED=false on this deployment (deliberate operator choice) means
  // this endpoint 403s for an unauthenticated caller -- it must be called as a privileged
  // (superadmin) user, see App\V1Module\Presenters\RegistrationPresenter::checkCreateAccount.
  const created = await api<{ user: { id: string } | null; accessToken: string }>(
    "POST",
    "/users",
    {
      token: adminToken,
      body: {
        email: spec.email,
        firstName: spec.firstName,
        lastName: spec.lastName,
        password: SEED_PASSWORD,
        passwordConfirm: SEED_PASSWORD,
        instanceId,
        ignoreNameCollision: true,
      },
    },
  );
  if (!created.user) {
    throw new Error(
      `Registration of ${spec.email} returned no user (unexpected name collision response).`,
    );
  }
  log(`user created: ${spec.email}`);
  return { token: created.accessToken, userId: created.user.id };
}

async function ensureGlobalRole(adminToken: string, userId: string, role: SeedUserSpec["role"]) {
  if (!role || role === "student") return; // "student" is the API's own default for new accounts
  const detail = await api<{ privateData: { role: string } }>("GET", `/users/${userId}`, {
    token: adminToken,
  });
  if (detail.privateData.role === role) return;
  await api("POST", `/users/${userId}/role`, { token: adminToken, body: { role } });
  log(`role set: ${userId} -> ${role}`);
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

interface GroupRecord {
  id: string;
  archived: boolean;
  localizedTexts: { locale: string; name: string }[];
  privateData: { admins: string[]; supervisors: string[]; students: string[] };
}

async function findGroupByName(
  adminToken: string,
  instanceId: string,
  name: string,
): Promise<GroupRecord | null> {
  const results = await api<GroupRecord[]>(
    "GET",
    `/groups?instanceId=${instanceId}&search=${encodeURIComponent(name)}&archived=true`,
    { token: adminToken },
  );
  return results.find((g) => g.localizedTexts.some((t) => t.name === name)) ?? null;
}

async function getOrCreateGroup(
  adminToken: string,
  instanceId: string,
  opts: { name: string; parentGroupId?: string },
): Promise<GroupRecord> {
  const existing = await findGroupByName(adminToken, instanceId, opts.name);
  if (existing) {
    log(`group exists, reused: ${opts.name}`);
    return existing;
  }

  const created = await api<GroupRecord>("POST", "/groups", {
    token: adminToken,
    body: {
      instanceId,
      parentGroupId: opts.parentGroupId,
      localizedTexts: [{ locale: "en", name: opts.name, description: "" }],
      publicStats: true,
    },
  });
  log(`group created: ${opts.name}`);
  return created;
}

/**
 * Archive as the LAST step for a group, never at creation time: the API's `becomeMember`
 * permission (both student and non-student membership) requires `group.isNotArchived`, so
 * archiving before adding members would make this script unable to seed a populated,
 * retired-looking course -- see docs/DECISIONS.md.
 */
/**
 * Organizational groups hold other groups and carry no assignments of their own -- a real ReCodEx
 * concept that no seeded group exercised, so the badge for it and the "this group holds no
 * assignments" state had never been seen with data (F-029). core-api refuses the flag once a group
 * has students or assignments, so this only ever runs on a group created for the purpose.
 */
async function ensureOrganizational(adminToken: string, group: GroupRecord) {
  const detail = await api<{ organizational: boolean }>("GET", `/groups/${group.id}`, {
    token: adminToken,
  });
  if (detail.organizational) {
    log(`group already organizational, skipping (${group.id})`);
    return;
  }
  await api("POST", `/groups/${group.id}/organizational`, {
    token: adminToken,
    body: { value: true },
  });
  log(`group marked organizational: ${group.id}`);
}

async function ensureArchived(adminToken: string, group: GroupRecord) {
  if (group.archived) return;
  await api("POST", `/groups/${group.id}/archived`, { token: adminToken, body: { value: true } });
  group.archived = true;
  log(`group archived: ${group.localizedTexts[0]?.name ?? group.id}`);
}

/**
 * A group anyone in the instance may walk into (S-026). No seeded group was public and unjoined,
 * so the Join control -- and the only path a student has into a group without an invitation -- had
 * never been rendered. `isPublic` is part of the group's own settings, and core-api replaces the
 * whole group with what it is sent, so the existing texts have to go back with it.
 */
async function ensurePublic(adminToken: string, group: GroupRecord) {
  const detail = await api<{
    public: boolean;
    externalId: string;
    localizedTexts: { locale: string; name: string; description: string }[];
  }>("GET", `/groups/${group.id}`, { token: adminToken });
  if (detail.public) return false;

  // `actionUpdateGroup` replaces the whole group with what it is sent -- every field it reads has
  // to be present, or the ones left out are cleared (and `externalId` missing is a 500, not a 400).
  await api("POST", `/groups/${group.id}`, {
    token: adminToken,
    body: {
      localizedTexts: detail.localizedTexts.map((text) => ({
        locale: text.locale,
        name: text.name,
        description: text.description,
      })),
      externalId: detail.externalId ?? "",
      isPublic: true,
      publicStats: true,
      detaining: false,
    },
  });
  return true;
}

async function ensureStudentMember(adminToken: string, group: GroupRecord, userId: string) {
  if (group.privateData.students.includes(userId)) return;
  await api("POST", `/groups/${group.id}/students/${userId}`, { token: adminToken });
  group.privateData.students.push(userId);
}

async function ensureGroupMember(
  adminToken: string,
  group: GroupRecord,
  userId: string,
  type: "admin" | "supervisor" | "observer",
) {
  const already = type === "admin" ? group.privateData.admins : group.privateData.supervisors;
  if (already.includes(userId)) return;
  await api("POST", `/groups/${group.id}/members/${userId}`, { token: adminToken, body: { type } });
  already.push(userId);
}

// ---------------------------------------------------------------------------
// The one base exercise every assignment in this seed reuses -- see
// docs/DECISIONS.md for why a single hand-verified exercise, reused via many
// assignments, replaces "one exercise per assignment" for the pagination filler.
// ---------------------------------------------------------------------------

const EXERCISE_NAME = `${SEED_PREFIX} Echo Greeting`;
const EXPECTED_OUTPUT = "Hello, ReCodEx!\n";
// The python3 stdout pipeline is looked up by name at run time -- see findPipelineId() below.
// It used to be a hardcoded UUID, "verified live" against the instance this script was written
// against. That verification was real and the value was still wrong everywhere else: core-api
// assigns pipeline ids **when the runtime package is imported**, so every fresh database gets
// different ones, and the constant broke the moment the stack was stood up on another machine --
// precisely the one-command bootstrap DEC-052 was asked for.
const PYTHON_STDOUT_PIPELINE_NAME = "Python execution & evaluation [stdout]";
const TEST_NAME = "Test 1";
const HW_GROUP_ID = "01-default"; // matches WORKER_HWGROUP in the compose repo's .env

interface ExerciseRecord {
  id: string;
}

async function findExerciseByName(
  adminToken: string,
  name: string,
): Promise<ExerciseRecord | null> {
  // `filters[archived]=all` is not optional here: the default list **excludes archived
  // exercises**, so without it a lookup by name cannot see one -- and this function's caller
  // would create a second copy of it on every run. Found exactly that way (T-020's archived
  // catalog fixture was duplicated once before this line was written).
  const results = await api<{ items: { name: string; id: string }[] }>(
    "GET",
    "/exercises?limit=1000&filters%5Barchived%5D=all",
    {
      token: adminToken,
    },
  );
  const match = results.items.find((e) => e.name === name);
  return match ? { id: match.id } : null;
}

interface PipelineRecord {
  id: string;
  name: string;
  runtimeEnvironmentIds?: string[];
}

/**
 * Resolves a pipeline id by name and runtime environment. `/v1/pipelines` returns a paginated
 * envelope (`{items, ...}`), unlike some sibling list endpoints that return a bare array -- both
 * shapes are accepted here rather than assumed, since that inconsistency has already caught this
 * project once (see the command palette's search route).
 */
async function findPipelineId(
  adminToken: string,
  name: string,
  runtimeEnvironmentId: string,
): Promise<string> {
  const payload = await api<PipelineRecord[] | { items?: PipelineRecord[] }>("GET", "/pipelines", {
    token: adminToken,
  });
  const pipelines = Array.isArray(payload) ? payload : (payload.items ?? []);
  const match = pipelines.find(
    (pipeline) =>
      pipeline.name === name &&
      (pipeline.runtimeEnvironmentIds ?? []).includes(runtimeEnvironmentId),
  );

  if (!match) {
    throw new Error(
      `Pipeline "${name}" for runtime "${runtimeEnvironmentId}" not found. The runtime package is ` +
        `probably not imported on this instance -- see the compose repo's README, "Language toolchains".`,
    );
  }
  return match.id;
}

/**
 * Exercises whose only job is to be *found* (T-020).
 *
 * The catalog is a search-and-filter screen and this instance held exactly one exercise, which
 * proves nothing about either. These are deliberately **unconfigured**: created with core-api's
 * defaults and left that way, so each is `isBroken`, has no reference solution and cannot be
 * assigned -- which is a real state a catalog has to render, and the same state a half-written
 * exercise is in. One is archived, some carry tags, and the difficulties vary, so every filter on
 * the screen has something to filter by.
 *
 * Idempotent like everything else here: matched by name before creating, and the properties are
 * rewritten each run (a `POST /exercises/{id}` replaces, it does not merge).
 */
const CATALOG_DIFFICULTIES = ["easy", "medium", "hard"] as const;

const CATALOG_FILLERS: {
  suffix: string;
  difficulty: string;
  tags: string[];
  archived: boolean;
}[] = [
  { suffix: "Binary Search", difficulty: "easy", tags: ["seed-algorithms"], archived: false },
  { suffix: "Merge Sort", difficulty: "medium", tags: ["seed-algorithms"], archived: false },
  {
    suffix: "Graph Colouring",
    difficulty: "hard",
    tags: ["seed-algorithms", "seed-graphs"],
    archived: false,
  },
  { suffix: "String Reversal", difficulty: "easy", tags: [], archived: false },
  { suffix: "Matrix Multiplication", difficulty: "medium", tags: ["seed-graphs"], archived: false },
  { suffix: "Retired Puzzle", difficulty: "hard", tags: [], archived: true },
  // Bulk, so the catalog is more than one page: the same reason FILLER_COUNT exists above.
  ...Array.from({ length: 18 }, (_, index) => ({
    suffix: `Catalog Filler ${String(index + 1).padStart(2, "0")}`,
    difficulty: CATALOG_DIFFICULTIES[index % CATALOG_DIFFICULTIES.length]!,
    tags: [] as string[],
    archived: false,
  })),
];

/**
 * Two exercises **authored by somebody other than the administrator**, so the catalog has a second
 * author to filter by (G-018's "only mine").
 *
 * **This fixture existed by accident until 2026-09-10 and nobody knew.** `exercise-catalog.spec.ts`
 * asserts that filtering to one author gives a total larger than zero and smaller than everything,
 * and its own comment says "the seed splits the catalog cleanly between two authors" -- which the
 * seed did not do. What it was actually reading were exercises left behind by failed
 * `exercise-edit` runs, all named "Exercise by Sam Supervisor" because that is what core-api calls
 * a fresh one. PF-007 stopped those being created; deleting the ones already there took the
 * fixture with them. So the seed now makes what the spec always claimed it made.
 *
 * Created as the supervisor rather than assigned to them afterwards: core-api sets `authorId` from
 * whoever calls `POST /exercises` and there is no endpoint that changes it. They are left
 * unconfigured, like the catalog fillers -- an exercise nobody can assign still counts in a
 * catalog, which is the whole of what this fixture is for.
 */
async function ensureAuthoredExercises(
  supervisorToken: string,
  ownerGroupId: string,
): Promise<number> {
  let created = 0;

  for (const suffix of ["Supervisor's Draft", "Supervisor's Second Draft"]) {
    const name = `${SEED_PREFIX} ${suffix}`;
    if (await findExerciseByName(supervisorToken, name)) continue;

    const { id } = await api<{ id: string }>("POST", "/exercises", {
      token: supervisorToken,
      body: { groupId: ownerGroupId },
    });
    const current = await api<{ version: number }>("GET", `/exercises/${id}`, {
      token: supervisorToken,
    });
    await api("POST", `/exercises/${id}`, {
      token: supervisorToken,
      body: {
        version: current.version,
        difficulty: "medium",
        localizedTexts: [
          {
            locale: "en",
            name,
            text: "A catalog fixture with an author of its own. Nothing is configured here.",
            link: "",
            description: "",
          },
        ],
        isPublic: true,
        isLocked: false,
        mergeJudgeLogs: true,
        solutionFilesLimit: 5,
        solutionSizeLimit: 65536,
      },
    });
    created++;
  }

  return created;
}

async function ensureCatalogExercises(adminToken: string, ownerGroupId: string): Promise<number> {
  let created = 0;

  for (const filler of CATALOG_FILLERS) {
    const name = `${SEED_PREFIX} ${filler.suffix}`;
    const existing = await findExerciseByName(adminToken, name);
    const id =
      existing?.id ??
      (
        await api<{ id: string }>("POST", "/exercises", {
          token: adminToken,
          body: { groupId: ownerGroupId },
        })
      ).id;
    if (!existing) created++;

    const current = await api<{ version: number; tags: string[]; archivedAt: number | null }>(
      "GET",
      `/exercises/${id}`,
      { token: adminToken },
    );

    await api("POST", `/exercises/${id}`, {
      token: adminToken,
      body: {
        version: current.version,
        difficulty: filler.difficulty,
        localizedTexts: [
          {
            locale: "en",
            name,
            text: `A catalog fixture. Nothing is configured here, so it cannot be assigned.`,
            link: "",
            description: "",
          },
        ],
        solutionFilesLimit: 5,
        solutionSizeLimit: 65536,
        mergeJudgeLogs: true,
        isPublic: true,
        isLocked: false,
      },
    });

    for (const tag of filler.tags) {
      if (!current.tags.includes(tag)) {
        await api("POST", `/exercises/${id}/tags/${tag}`, { token: adminToken });
      }
    }

    if ((current.archivedAt !== null) !== filler.archived) {
      await api("POST", `/exercises/${id}/archived`, {
        token: adminToken,
        body: { archived: filler.archived },
      });
    }
  }

  return created;
}

async function getOrCreateBaseExercise(
  adminToken: string,
  ownerGroupId: string,
): Promise<ExerciseRecord> {
  // Reusing an existing exercise by name is *not* the same as it being usable. A run that dies
  // partway (as one did, on the hardcoded pipeline id above) leaves an exercise that exists,
  // matches by name, and is rejected by core-api as "broken" the moment anything tries to assign
  // it. So the configuration steps below run every time, for a reused exercise as much as a fresh
  // one -- they are all idempotent writes that replace rather than append. Only the creation
  // itself is conditional.
  const existing = await findExerciseByName(adminToken, EXERCISE_NAME);
  if (existing) {
    log(`exercise exists, reconfiguring: ${EXERCISE_NAME}`);
  }

  const id =
    existing?.id ??
    (
      await api<{ id: string }>("POST", "/exercises", {
        token: adminToken,
        body: { groupId: ownerGroupId },
      })
    ).id;

  await api("POST", `/exercises/${id}/hardware-groups`, {
    token: adminToken,
    body: { hwGroups: [HW_GROUP_ID] },
  });
  // The environment config is what declares **which uploaded files are the solution**, and it is
  // not optional decoration: `ExerciseConfigHelper::getEnvironmentsForFiles()` -- the whole of
  // `POST /pre-submit` -- looks for a *file* variable here, wildcard-matches the submitted file
  // names against its values, and reports an environment as suitable only if every uploaded file
  // was matched by one. With an empty table it matches nothing, so `pre-submit` answered
  // `environments: []` for a perfectly good `solution.py` and the submit form had nothing to
  // offer. The seed's own submissions never noticed, because they pass `runtimeEnvironmentId`
  // directly and skip pre-submit entirely; S-014 is the first thing to go through the real path.
  await api("POST", `/exercises/${id}/environment-configs`, {
    token: adminToken,
    body: {
      environmentConfigs: [
        {
          runtimeEnvironmentId: "python3",
          variablesTable: [{ name: "source-files", type: "file[]", value: ["*.py"] }],
        },
      ],
    },
  });

  // `POST /tests` *adds* rather than replaces: re-running it with the same name fails with
  // "given test name 'Test 1' is already taken". Sending the existing test's id turns the same
  // call into an update, which is what makes re-running this script safe on an instance that
  // already has the exercise.
  const existingTests = await api<{ id: number; name: string }[]>("GET", `/exercises/${id}/tests`, {
    token: adminToken,
  });
  const existingTest = existingTests.find((candidate) => candidate.name === TEST_NAME);

  const test = await api<{ id: number }[]>("POST", `/exercises/${id}/tests`, {
    token: adminToken,
    body: {
      tests: [existingTest ? { id: existingTest.id, name: TEST_NAME } : { name: TEST_NAME }],
    },
  });
  const firstTest = test[0];
  if (!firstTest) throw new Error("POST /exercises/{id}/tests returned no test.");
  const testId = firstTest.id;

  // core-api guards exercise edits with optimistic concurrency: the payload must carry the
  // exercise's *current* version, and a hardcoded 1 only works on an exercise nobody has touched.
  // Every re-run of this script bumps it, so read it back rather than assuming.
  const current = await api<{ version: number }>("GET", `/exercises/${id}`, { token: adminToken });

  await api("POST", `/exercises/${id}`, {
    token: adminToken,
    body: {
      version: current.version,
      difficulty: "easy",
      localizedTexts: [
        {
          locale: "en",
          name: EXERCISE_NAME,
          text: `Read a line and print exactly: ${EXPECTED_OUTPUT.trim()}`,
          link: "",
          description: "",
        },
      ],
      solutionFilesLimit: 5,
      solutionSizeLimit: 65536,
      mergeJudgeLogs: true,
      isPublic: true,
      isLocked: false,
    },
  });

  const expectedUpload = await apiUpload(
    adminToken,
    "/uploaded-files",
    "expected.txt",
    EXPECTED_OUTPUT,
  );
  await api("POST", `/exercises/${id}/files`, {
    token: adminToken,
    body: { files: [expectedUpload.id] },
  });

  // Resolved once and reused: the config below refers to the same pipeline by id, and looking it
  // up twice would be two round trips for one answer.
  const pipelineId = await findPipelineId(adminToken, PYTHON_STDOUT_PIPELINE_NAME, "python3");

  const variables = await api<{ variables: { name: string; type: string; value: unknown }[] }[]>(
    "POST",
    `/exercises/${id}/config/variables`,
    {
      token: adminToken,
      body: { runtimeEnvironmentId: "python3", pipelinesIds: [pipelineId] },
    },
  );
  const firstVariableSet = variables[0];
  if (!firstVariableSet)
    throw new Error("POST /exercises/{id}/config/variables returned no variable set.");
  const varMap = new Map(firstVariableSet.variables.map((v) => [v.name, v] as const));
  varMap.set("expected-output", { ...varMap.get("expected-output")!, value: "expected.txt" });
  varMap.set("judge-type", { ...varMap.get("judge-type")!, value: "recodex-judge-normal" });
  varMap.set("success-exit-codes", { ...varMap.get("success-exit-codes")!, value: ["0"] });

  await api("POST", `/exercises/${id}/config`, {
    token: adminToken,
    body: {
      config: [
        {
          name: "python3",
          tests: [
            {
              name: testId,
              pipelines: [{ name: pipelineId, variables: Array.from(varMap.values()) }],
            },
          ],
        },
      ],
    },
  });

  await api("POST", `/exercises/${id}/limits`, {
    token: adminToken,
    body: {
      limits: { [HW_GROUP_ID]: { python3: { [testId]: { memory: 65536, "wall-time": 5 } } } },
    },
  });

  // Every other write above replaces; this one *appends*, so it needs its own guard. Without it
  // each run added another reference solution to the same exercise -- harmless individually, and
  // a steadily growing list on any machine where the seed is re-run often. Found by re-running it
  // four times while building F-029's fixtures.
  const referenceNote = `${SEED_PREFIX} reference solution`;
  const references = await api<{ description: string }[]>(
    "GET",
    `/reference-solutions/exercise/${id}`,
    { token: adminToken },
  );
  if (references.some((reference) => reference.description === referenceNote)) {
    log(`reference solution already exists, skipping submit`);
  } else {
    const solutionUpload = await apiUpload(
      adminToken,
      "/uploaded-files",
      "solution.py",
      `print("${EXPECTED_OUTPUT.trim()}")\n`,
    );
    await api("POST", `/reference-solutions/exercise/${id}/submit`, {
      token: adminToken,
      body: {
        note: referenceNote,
        files: [solutionUpload.id],
        runtimeEnvironmentId: "python3",
      },
    });
    log(`reference solution submitted`);
  }

  log(existing ? `exercise reconfigured: ${EXERCISE_NAME}` : `exercise created: ${EXERCISE_NAME}`);
  return { id };
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

interface AssignmentDetail {
  id: string;
  version: number;
  createdAt: number;
  solutionFilesLimit: number;
  solutionSizeLimit: number;
}

async function createAssignment(
  adminToken: string,
  exerciseId: string,
  groupId: string,
  opts: {
    firstDeadlineDays: number;
    maxPoints: number;
    hint: string;
    /** Days after the first deadline. Set on exactly one seeded assignment (F-029): the "second
     *  chance" deadline state has three UI surfaces (`DeadlineBadge`, the calendar's second-
     *  deadline tone, the assignment screen's second-deadline row) and no data behind any of them
     *  otherwise. */
    secondDeadlineDays?: number;
    secondDeadlineMaxPoints?: number;
  },
): Promise<AssignmentDetail> {
  const created = await api<AssignmentDetail>("POST", "/exercise-assignments", {
    token: adminToken,
    body: { exerciseId, groupId },
  });

  const firstDeadline = Math.floor(Date.now() / 1000) + opts.firstDeadlineDays * 86400;
  const allowSecondDeadline = opts.secondDeadlineDays !== undefined;
  await api("POST", `/exercise-assignments/${created.id}`, {
    token: adminToken,
    body: {
      version: created.version,
      isPublic: true,
      localizedStudentHints: { en: opts.hint },
      firstDeadline,
      maxPointsBeforeFirstDeadline: opts.maxPoints,
      submissionsCountLimit: 20,
      solutionFilesLimit: created.solutionFilesLimit,
      solutionSizeLimit: created.solutionSizeLimit,
      allowSecondDeadline,
      ...(allowSecondDeadline
        ? {
            secondDeadline: firstDeadline + opts.secondDeadlineDays! * 86400,
            maxPointsBeforeSecondDeadline: opts.secondDeadlineMaxPoints ?? opts.maxPoints,
          }
        : {}),
      canViewLimitRatios: true,
      canViewMeasuredValues: true,
      canViewJudgeStdout: true,
      canViewJudgeStderr: true,
      maxPointsDeadlineInterpolation: false,
      isBonus: false,
    },
  });
  log(`assignment created: ${opts.hint}`);
  return created;
}

/**
 * An assignment is a *snapshot* of its exercise, not a live view of it: fixing the exercise's
 * configuration leaves every assignment already made from it on the old copy, and core-api reports
 * the difference in `exerciseSynchronizationInfo`. This matters here because the environment
 * config fix above (the one that makes `pre-submit` able to detect a language at all) is exactly
 * such a change -- without this step it would only ever apply to a database seeded from scratch.
 *
 * Verified that syncing preserves the assignment's own settings: the deadlines, points and the
 * `[seed]` student hint all survive; only the exercise-derived halves (config, environment
 * configs, limits, files) are replaced.
 */
async function ensureAssignmentSynced(adminToken: string, assignmentId: string): Promise<boolean> {
  const assignment = await api<{
    exerciseSynchronizationInfo: Record<string, unknown>;
  }>("GET", `/exercise-assignments/${assignmentId}`, { token: adminToken });

  const stale = Object.entries(assignment.exerciseSynchronizationInfo).filter(
    ([, value]) =>
      typeof value === "object" &&
      value !== null &&
      (value as { upToDate?: boolean }).upToDate === false,
  );
  if (stale.length === 0) return false;

  await api("POST", `/exercise-assignments/${assignmentId}/sync-exercise`, { token: adminToken });
  return true;
}

/** Existing assignments in a group whose exerciseId matches -- used to make assignment creation idempotent. */
async function findAssignmentsForExercise(
  adminToken: string,
  group: GroupRecord,
  exerciseId: string,
): Promise<AssignmentDetail[]> {
  const detail = await api<{ privateData: { assignments: string[] } }>(
    "GET",
    `/groups/${group.id}`,
    {
      token: adminToken,
    },
  );
  const result: AssignmentDetail[] = [];
  for (const id of detail.privateData.assignments) {
    const a = await api<AssignmentDetail & { exerciseId: string }>(
      "GET",
      `/exercise-assignments/${id}`,
      {
        token: adminToken,
      },
    );
    if (a.exerciseId === exerciseId) result.push(a);
  }
  // Sorted, because callers pick "the primary assignment" by position and core-api returns the
  // group's assignment ids in no promised order. An unsorted list made an earlier run submit its
  // solutions to a different assignment than a later one -- which is how this instance ended up
  // with two solutions noted "[seed] correct" under two different assignments.
  return result.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

async function submitSolution(
  studentToken: string,
  studentId: string,
  assignmentId: string,
  note: string,
  code: string | Uint8Array<ArrayBuffer>,
  file: { name: string; mimeType: string } = { name: "solution.py", mimeType: "text/plain" },
) {
  const existing = await api<{ note: string }[]>(
    "GET",
    `/exercise-assignments/${assignmentId}/users/${studentId}/solutions`,
    { token: studentToken },
  );
  if (existing.some((s) => s.note === note)) {
    log(`solution already exists, skipping submit (${note})`);
    return;
  }

  const upload = await apiUpload(studentToken, "/uploaded-files", file.name, code, file.mimeType);
  await api("POST", `/exercise-assignments/${assignmentId}/submit`, {
    token: studentToken,
    body: { note, files: [upload.id], runtimeEnvironmentId: "python3" },
  });
  log(`submitted: ${note}`);
}

interface SolutionRecord {
  id: string;
  note: string;
  reviewRequest: boolean;
  review: { startedAt: number; closedAt: number | null; issues: number } | null;
}

async function findSolutionByNote(
  token: string,
  assignmentId: string,
  studentId: string,
  note: string,
): Promise<SolutionRecord | null> {
  const solutions = await api<SolutionRecord[]>(
    "GET",
    `/exercise-assignments/${assignmentId}/users/${studentId}/solutions`,
    { token },
  );
  return solutions.find((s) => s.note === note) ?? null;
}

/**
 * A student asking their teacher to look at a solution -- the row the teacher dashboard's
 * "review requests" panel (S-002) is built to show. Set by the student themselves, which is who
 * core-api authorises for this flag (`canSetFlagAsStudent`).
 */
async function ensureReviewRequested(
  studentToken: string,
  studentId: string,
  assignmentId: string,
  note: string,
) {
  const solution = await findSolutionByNote(studentToken, assignmentId, studentId, note);
  if (!solution) throw new Error(`no solution noted '${note}' to request a review for`);
  if (solution.reviewRequest) {
    log(`review already requested, skipping (${note})`);
    return;
  }
  await api("POST", `/assignment-solutions/${solution.id}/set-flag/reviewRequest`, {
    token: studentToken,
    body: { value: true },
  });
  log(`review requested: ${note}`);
}

/**
 * A review a teacher has opened and not closed -- the row the teacher dashboard's "pending
 * reviews" panel (S-002) is built to show. `close: false` sets `reviewStartedAt` and leaves
 * `reviewedAt` null, which is exactly what `findPendingReviewsOfTeacher` looks for.
 */
async function ensureReviewOpened(
  teacherToken: string,
  studentId: string,
  assignmentId: string,
  note: string,
) {
  const solution = await findSolutionByNote(teacherToken, assignmentId, studentId, note);
  if (!solution) throw new Error(`no solution noted '${note}' to open a review on`);
  if (solution.review && solution.review.closedAt === null) {
    log(`review already open, skipping (${note})`);
    return;
  }
  await api("POST", `/assignment-solutions/${solution.id}/review`, {
    token: teacherToken,
    body: { close: false },
  });
  log(`review opened: ${note}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * A finished exam with one lock record (S-008).
 *
 * The only unreachable state on the exams tab, and the only one with a recipe: core-api creates a
 * `GroupExam` **when a student first locks in**, never when the period is merely set, so a
 * previous exam -- and any lock record to show under it -- exists only if someone actually sat one.
 * The recipe is therefore the real sequence, compressed: set a period beginning now, let the
 * student lock themselves in, then end it by moving the end to now.
 *
 * Idempotent on the group already having a recorded exam, so a re-run neither piles up terms nor
 * locks anyone a second time. The period it opens is a minute wide even though it is ended within
 * a second of that: if this script dies in the middle, the group unsecures itself shortly after
 * rather than staying in exam mode until someone notices.
 */
async function ensureFinishedExam(
  adminToken: string,
  group: GroupRecord,
  student: { userId: string; token: string },
): Promise<boolean> {
  const before = await api<{ privateData?: { exams?: unknown[] } }>("GET", `/groups/${group.id}`, {
    token: adminToken,
  });
  if ((before.privateData?.exams ?? []).length > 0) return false;

  const begin = Math.floor(Date.now() / 1000);
  await api("POST", `/groups/${group.id}/examPeriod`, {
    token: adminToken,
    body: { begin, end: begin + 60, type: "visible" },
  });
  try {
    await api("POST", `/groups/${group.id}/lock/${student.userId}`, { token: student.token });
  } finally {
    // Ends the exam whatever happened to the lock -- a group left in secured mode would stop
    // every other seeded student from submitting anywhere in it. Never *at* the beginning: core-api
    // rejects a zero-wide interval, and the whole sequence here takes well under a second.
    await api("POST", `/groups/${group.id}/examPeriod`, {
      token: adminToken,
      body: { end: Math.max(begin + 2, Math.floor(Date.now() / 1000)) },
    });
  }
  return true;
}

/**
 * A reported similarity between two students' solutions (S-019).
 *
 * ReCodEx detects nothing itself: an external tool uploads what it found, so this fixture *is* the
 * upload -- create a batch, append one similarity, mark the batch complete. There is no other way
 * to reach the screen, and no endpoint to delete any of it afterwards, which is why this is
 * idempotent on the batch already existing for the tested solution.
 *
 * The fragment offsets are computed from the two sources rather than written down, so the marked
 * passages stay correct if either seeded solution is ever edited.
 */
const PLAGIARISM_TOOL = "seed-fixture";

async function firstSolutionFileId(token: string, solutionId: string): Promise<string> {
  const files = await api<{ id: string }[]>("GET", `/assignment-solutions/${solutionId}/files`, {
    token,
  });
  const file = files[0];
  if (!file) throw new Error(`solution ${solutionId} has no files to point a similarity at`);
  return file.id;
}

async function ensureDetectedSimilarity(
  adminToken: string,
  assignmentId: string,
  tested: { solutionId: string; source: string },
  other: { solutionId: string; authorId: string; source: string },
  sharedText: string,
): Promise<boolean> {
  const batches = await api<{ id: string }[]>(
    "GET",
    `/plagiarism?detectionTool=${encodeURIComponent(PLAGIARISM_TOOL)}&solutionId=${tested.solutionId}`,
    { token: adminToken },
  );
  if (batches.length > 0) return false;

  const [testedFileId, otherFileId] = await Promise.all([
    firstSolutionFileId(adminToken, tested.solutionId),
    firstSolutionFileId(adminToken, other.solutionId),
  ]);

  const batch = await api<{ id: string }>("POST", "/plagiarism", {
    token: adminToken,
    body: { detectionTool: PLAGIARISM_TOOL, detectionToolParams: "--seeded" },
  });

  await api("POST", `/plagiarism/${batch.id}/${tested.solutionId}`, {
    token: adminToken,
    body: {
      solutionFileId: testedFileId,
      authorId: other.authorId,
      similarity: 0.87,
      files: [
        {
          solutionId: other.solutionId,
          solutionFileId: otherFileId,
          fileEntry: "",
          fragments: [
            [
              { offset: tested.source.indexOf(sharedText), length: sharedText.length },
              { offset: other.source.indexOf(sharedText), length: sharedText.length },
            ],
          ],
        },
      ],
    },
  });

  await api("POST", `/plagiarism/${batch.id}`, {
    token: adminToken,
    body: { uploadCompleted: true, assignments: [assignmentId] },
  });
  return true;
}

/**
 * A shadow assignment with points awarded to one student (S-020).
 *
 * The only kind of assignment in ReCodEx with nothing to submit: the teacher types the points in.
 * Creating one takes two calls -- `POST /shadow-assignments` makes an empty, non-public record,
 * and `update-detail` is what gives it a name, a text, a points limit and visibility (its `version`
 * has to match, which is core-api's optimistic-locking check).
 *
 * Idempotent on the group already having a shadow assignment, and on the student already having
 * points in it.
 */
/**
 * A shadow assignment, matched by its own name so a second one can exist beside the first --
 * S-025's dashboard section has an "awarded" row and a "nothing yet" row, and only one of those
 * was reachable while the seed produced a single, always-awarded assignment.
 *
 * `awardee` omitted means exactly that: create it and award nobody.
 */
async function ensureShadowAssignment(
  adminToken: string,
  group: GroupRecord,
  spec: { name: string; text: string; maxPoints: number; note?: string },
  awardee?: { userId: string },
): Promise<boolean> {
  const existing = await api<
    { id: string; localizedTexts: { name: string }[]; points?: { awardeeId: string }[] }[]
  >("GET", `/groups/${group.id}/shadow-assignments`, { token: adminToken });
  const match = existing.find((assignment) =>
    assignment.localizedTexts.some((text) => text.name === spec.name),
  );

  if (match) {
    if (!awardee) return false;
    if (match.points?.some((record) => record.awardeeId === awardee.userId)) return false;
    await api("POST", `/shadow-assignments/${match.id}/create-points`, {
      token: adminToken,
      body: { userId: awardee.userId, points: 8, note: spec.note ?? "" },
    });
    return true;
  }

  const created = await api<{ id: string; version: number }>("POST", "/shadow-assignments", {
    token: adminToken,
    body: { groupId: group.id },
  });
  await api("POST", `/shadow-assignments/${created.id}`, {
    token: adminToken,
    body: {
      version: created.version,
      isPublic: true,
      isBonus: false,
      maxPoints: spec.maxPoints,
      sendNotification: false,
      deadline: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
      localizedTexts: [{ locale: "en", name: spec.name, text: spec.text }],
    },
  });
  if (awardee) {
    await api("POST", `/shadow-assignments/${created.id}/create-points`, {
      token: adminToken,
      body: { userId: awardee.userId, points: 8, note: spec.note ?? "" },
    });
  }
  return true;
}

/**
 * The four invitation links S-023's page can be reached by, one per state it renders. No group had
 * any, so every branch of that screen was unreachable.
 *
 * Matched by their note rather than by id, the same way `findSolutionByNote` does it: core-api
 * gives an invitation no name, and re-running the seed must not mint a fifth link every time.
 * `expireAt` in the past is a legitimate value core-api accepts on create -- it validates the
 * timestamp, not its direction -- which is the only way to seed an expired link without waiting.
 */
async function ensureGroupInvitation(
  adminToken: string,
  group: GroupRecord,
  note: string,
  expireAtSeconds: number | null,
): Promise<boolean> {
  const existing = await api<{ id: string; note: string | null }[]>(
    "GET",
    `/groups/${group.id}/invitations`,
    { token: adminToken },
  );
  if (existing.some((invitation) => invitation.note === note)) return false;

  await api("POST", `/groups/${group.id}/invitations`, {
    token: adminToken,
    body: { expireAt: expireAtSeconds, note },
  });
  return true;
}

/**
 * Which instance to seed into.
 *
 * **This used to be `instances[0]`, and that was a real bug rather than a shortcut.** This
 * deployment has two instances, `GET /instances` guarantees no ordering, and the order it returns
 * evidently changed between runs: an earlier run seeded one instance and a later one seeded the
 * *other*, leaving two half-sets of identically-named groups across two roots. Every spec that
 * navigates by group name then matched two links, or none, depending on which half it found -- and
 * three sessions in a row diagnosed that as "the group is missing" because nothing said which
 * instance anybody was looking at.
 *
 * So the instance is chosen by **where this script's own groups already are**, which makes a
 * re-run land where the last run landed however `/instances` is ordered -- the property this
 * script's own docblock claims ("safe to run again on top of its own previous output"). Only when
 * no seeded group exists anywhere does it fall back to the first instance, and it says so.
 *
 * `SEED_INSTANCE_ID` overrides both, for an operator who wants a specific one.
 */
async function chooseInstance(adminToken: string): Promise<string> {
  const instances = await api<{ id: string }[]>("GET", "/instances", { token: adminToken });
  if (instances.length === 0) throw new Error("GET /instances returned no instances.");

  const override = process.env.SEED_INSTANCE_ID;
  if (override) {
    if (!instances.some((i) => i.id === override)) {
      throw new Error(`SEED_INSTANCE_ID=${override} is not one of this deployment's instances.`);
    }
    log(`instance ${override} (from SEED_INSTANCE_ID)`);
    return override;
  }

  // Any of this script's own top-level groups anchors the choice, not one particular name: a run
  // that died part-way may have created only some of them, which is exactly the state this
  // function exists to recover from.
  const anchors = [
    `${SEED_PREFIX} Intro to Programming`,
    `${SEED_PREFIX} Large Lecture`,
    `${SEED_PREFIX} Faculty of Seeded Studies`,
  ];
  for (const instance of instances) {
    for (const anchor of anchors) {
      if (await findGroupByName(adminToken, instance.id, anchor)) {
        log(`instance ${instance.id} (already holds ${anchor}, reusing it)`);
        return instance.id;
      }
    }
  }

  const first = instances[0]!;
  log(
    `instance ${first.id} (nothing seeded anywhere yet; ${instances.length} instance(s) exist, ` +
      `set SEED_INSTANCE_ID to choose)`,
  );
  return first.id;
}

async function main() {
  log(`seeding against ${API_BASE}`);
  const nowSeconds = Math.floor(Date.now() / 1000);

  const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const instanceId = await chooseInstance(admin.token);

  // Groups -- G1 has a subgroup, G2 is archived, G3 exists purely to exercise pagination.
  const g1 = await getOrCreateGroup(admin.token, instanceId, {
    name: `${SEED_PREFIX} Intro to Programming`,
  });
  const g1a = await getOrCreateGroup(admin.token, instanceId, {
    name: `${SEED_PREFIX} Intro to Programming / Lab A`,
    parentGroupId: g1.id,
  });
  const g2 = await getOrCreateGroup(admin.token, instanceId, {
    name: `${SEED_PREFIX} Retired Course`,
  });
  const g3 = await getOrCreateGroup(admin.token, instanceId, {
    name: `${SEED_PREFIX} Large Lecture`,
  });

  // Users -- one per role combination called for in the brief; admin@admin.com (superadmin)
  // is reused as-is, never duplicated.
  const student1 = await getOrCreateUser(admin.token, instanceId, {
    email: "alice.student@seed.recodex.local",
    firstName: "Alice",
    lastName: "Student",
  });
  await ensureStudentMember(admin.token, g1, student1.userId);

  // A second student in G1, so there is somebody for a detected similarity to be *with* (S-019):
  // a plagiarism record needs two authors, and Alice was the only student in the group.
  const student2 = await getOrCreateUser(admin.token, instanceId, {
    email: "bob.classmate@seed.recodex.local",
    firstName: "Bob",
    lastName: "Classmate",
  });
  await ensureStudentMember(admin.token, g1, student2.userId);

  const supervisor1 = await getOrCreateUser(admin.token, instanceId, {
    email: "sam.supervisor@seed.recodex.local",
    firstName: "Sam",
    lastName: "Supervisor",
    role: "supervisor",
  });
  await ensureGlobalRole(admin.token, supervisor1.userId, "supervisor");
  await ensureGroupMember(admin.token, g1, supervisor1.userId, "admin");
  await ensureGroupMember(admin.token, g2, supervisor1.userId, "supervisor");
  await ensureArchived(admin.token, g2); // after membership -- see ensureArchived's comment

  const supervisorStudent1 = await getOrCreateUser(admin.token, instanceId, {
    email: "sasha.mentor@seed.recodex.local",
    firstName: "Sasha",
    lastName: "Mentor",
    role: "supervisor-student",
  });
  await ensureGlobalRole(admin.token, supervisorStudent1.userId, "supervisor-student");
  await ensureGroupMember(admin.token, g3, supervisorStudent1.userId, "admin");
  await ensureStudentMember(admin.token, g1a, supervisorStudent1.userId);

  // A user who belongs to nowhere (F-029): the state every genuinely new account starts in, and
  // the only way to reach the dashboard's "no group memberships" empty state.
  const newcomer = await getOrCreateUser(admin.token, instanceId, {
    email: "seed.newcomer@seed.recodex.local",
    firstName: "Nora",
    lastName: "Newcomer",
  });
  log(`newcomer (no memberships): ${newcomer.userId}`);

  // An organizational group (F-029): holds other groups, carries no assignments of its own.
  const g4 = await getOrCreateGroup(admin.token, instanceId, {
    name: `${SEED_PREFIX} Faculty of Seeded Studies`,
  });
  await ensureOrganizational(admin.token, g4);

  // The one exercise every assignment below reuses -- built and verified once; see
  // docs/DECISIONS.md for the full API recipe this encodes and why it's a single exercise
  // rather than one per assignment.
  const exercise = await getOrCreateBaseExercise(admin.token, g1.id);

  // G1: a "real" assignment with mixed submission states, plus a second assignment with
  // nothing submitted -- both required states per the brief. Reuse by position (existing[0]
  // is always the primary one) if this group already has assignments for this exercise.
  const existingG1Assignments = await findAssignmentsForExercise(admin.token, g1, exercise.id);
  const primaryAssignment =
    existingG1Assignments[0] ??
    (await createAssignment(admin.token, exercise.id, g1.id, {
      firstDeadlineDays: 14,
      maxPoints: 10,
      hint: "Print the exact greeting, including the newline.",
    }));
  await submitSolution(
    student1.token,
    student1.userId,
    primaryAssignment.id,
    `${SEED_PREFIX} correct`,
    `print("${EXPECTED_OUTPUT.trim()}")\n`,
  );
  await submitSolution(
    student1.token,
    student1.userId,
    primaryAssignment.id,
    `${SEED_PREFIX} wrong`,
    `print("Nope")\n`,
  );

  // A solution submitted as a single ZIP archive (S-017). core-api stores exactly this case as a
  // `SolutionZipFile` and reports its `zipEntries` instead of its contents, which is the one input
  // that makes the source viewer expand entries into first-class files
  // (`solution.zip#main.py`) -- and the only way to produce it is to submit a real archive.
  await submitSolution(
    student1.token,
    student1.userId,
    primaryAssignment.id,
    `${SEED_PREFIX} zip archive`,
    storedZip([
      ["main.py", "from greeting import GREETING\n\nprint(GREETING)\n"],
      ["greeting.py", `GREETING = "${EXPECTED_OUTPUT.trim()}"\n`],
    ]),
    { name: "solution.zip", mimeType: "application/zip" },
  );

  // Teacher-facing fixtures (S-002): one solution whose author has asked for a review, and one
  // whose review a teacher has opened and not finished. Neither state can be produced by
  // submitting alone, and without them the teacher dashboard has nothing to render.
  await ensureReviewRequested(
    student1.token,
    student1.userId,
    primaryAssignment.id,
    `${SEED_PREFIX} correct`,
  );
  await ensureReviewOpened(
    admin.token,
    student1.userId,
    primaryAssignment.id,
    `${SEED_PREFIX} wrong`,
  );

  if (!existingG1Assignments[1]) {
    await createAssignment(admin.token, exercise.id, g1.id, {
      firstDeadlineDays: 21,
      maxPoints: 10,
      hint: "Nothing submitted yet -- exercises the empty-submissions UI state.",
    });
  }

  // The only assignment anywhere with a second deadline (F-029).
  if (!existingG1Assignments[2]) {
    await createAssignment(admin.token, exercise.id, g1.id, {
      firstDeadlineDays: 3,
      maxPoints: 10,
      secondDeadlineDays: 14,
      secondDeadlineMaxPoints: 5,
      hint: "Has a second deadline -- worth fewer points after the first one passes.",
    });
  }

  // G3: enough students and assignments to force pagination in any list/table view.
  const fillerStudentIds: string[] = [];
  for (let i = 1; i <= FILLER_COUNT; i++) {
    const n = String(i).padStart(2, "0");
    const filler = await getOrCreateUser(admin.token, instanceId, {
      email: `seed.filler.${n}@seed.recodex.local`,
      firstName: `${SEED_PREFIX} Filler`,
      lastName: `Student ${n}`,
    });
    await ensureStudentMember(admin.token, g3, filler.userId);
    fillerStudentIds.push(filler.userId);
  }

  const existingFillerAssignments = (await findAssignmentsForExercise(admin.token, g3, exercise.id))
    .length;
  for (let i = existingFillerAssignments; i < FILLER_COUNT; i++) {
    await createAssignment(admin.token, exercise.id, g3.id, {
      firstDeadlineDays: 7 + i,
      maxPoints: 10,
      hint: `${SEED_PREFIX} filler assignment #${i + 1}`,
    });
  }
  if (existingFillerAssignments > 0) {
    log(
      `${existingFillerAssignments}/${FILLER_COUNT} filler assignments already existed, topped up the rest`,
    );
  }

  // A reported similarity between two students (S-019). Bob's solution shares one line with
  // Alice's, which is the passage the fixture marks on both sides.
  const SHARED_LINE = `print("${EXPECTED_OUTPUT.trim()}")`;
  const aliceSource = `${SHARED_LINE}\n`;
  const bobSource = `# my own work, obviously\n${SHARED_LINE}\n`;
  await submitSolution(
    student2.token,
    student2.userId,
    primaryAssignment.id,
    `${SEED_PREFIX} borrowed`,
    bobSource,
  );

  const aliceSolution = await findSolutionByNote(
    admin.token,
    primaryAssignment.id,
    student1.userId,
    `${SEED_PREFIX} correct`,
  );
  const bobSolution = await findSolutionByNote(
    admin.token,
    primaryAssignment.id,
    student2.userId,
    `${SEED_PREFIX} borrowed`,
  );
  if (aliceSolution && bobSolution) {
    log(
      (await ensureDetectedSimilarity(
        admin.token,
        primaryAssignment.id,
        { solutionId: aliceSolution.id, source: aliceSource },
        { solutionId: bobSolution.id, authorId: student2.userId, source: bobSource },
        SHARED_LINE,
      ))
        ? "uploaded one detected similarity between two students"
        : "a detected similarity was already recorded",
    );
  }

  // Two shadow assignments (S-020, S-025): one with points awarded to Alice, one with none, so the
  // dashboard's "awarded" and "nothing yet" rows are both reachable.
  const shadowSeeded = [
    await ensureShadowAssignment(
      admin.token,
      g1,
      {
        name: `${SEED_PREFIX} Oral Exam`,
        text: "Points for the oral exam. Nothing is submitted here — the examiner awards the points.",
        maxPoints: 10,
        note: `${SEED_PREFIX} oral exam`,
      },
      student1,
    ),
    await ensureShadowAssignment(admin.token, g1, {
      name: `${SEED_PREFIX} Term Presentation`,
      text: "Points for the end-of-term presentation. Nothing has been awarded yet.",
      maxPoints: 20,
    }),
  ].filter(Boolean).length;
  log(
    shadowSeeded > 0
      ? `created or awarded ${shadowSeeded} shadow assignments`
      : "both shadow assignments already existed",
  );

  // A public group nobody is enrolled in (S-026): the one shape of group a student can join on
  // their own, and the only way the Join control is reachable at all.
  const g5 = await getOrCreateGroup(admin.token, instanceId, {
    name: `${SEED_PREFIX} Open Enrolment`,
  });
  log(
    (await ensurePublic(admin.token, g5))
      ? "made a public group anyone may join"
      : "the public group already existed",
  );

  // One invitation link per state S-023's page renders (S-023). G3 is the group Alice can still
  // join; G1 is one she already studies in; G4 is organizational and G2 archived, neither of which
  // core-api will enrol anyone into. An archived group still accepts new *invitations* -- only
  // accepting them is refused -- which is what makes that last fixture possible at all.
  const invitations: [GroupRecord, string, number | null][] = [
    [g3, `${SEED_PREFIX} open invitation`, nowSeconds + 30 * 24 * 3600],
    [g3, `${SEED_PREFIX} expired invitation`, nowSeconds - 24 * 3600],
    [g1, `${SEED_PREFIX} invitation to a group already joined`, null],
    [g4, `${SEED_PREFIX} invitation to an organizational group`, nowSeconds + 30 * 24 * 3600],
    [g2, `${SEED_PREFIX} invitation to an archived group`, nowSeconds + 30 * 24 * 3600],
  ];
  let mintedInvitations = 0;
  for (const [group, note, expireAt] of invitations) {
    if (await ensureGroupInvitation(admin.token, group, note, expireAt)) mintedInvitations++;
  }
  log(
    mintedInvitations > 0
      ? `created ${mintedInvitations} group invitation links`
      : "the group invitation links already existed",
  );

  // A held exam, with the one lock record that makes it exist at all (S-008).
  log(
    (await ensureFinishedExam(admin.token, g1, student1))
      ? "recorded one finished exam, with a student lock"
      : "a finished exam was already recorded",
  );

  // Assignments are snapshots of the exercise, so any exercise fix above has to be pushed into the
  // ones already made from it -- see ensureAssignmentSynced. This runs on *every* seed, not only
  // the first: `getOrCreateBaseExercise` deliberately rewrites the exercise's configuration each
  // time (F-025's own reasoning), which by definition leaves every assignment one version behind.
  let synced = 0;
  for (const group of [g1, g3]) {
    for (const assignment of await findAssignmentsForExercise(admin.token, group, exercise.id)) {
      if (await ensureAssignmentSynced(admin.token, assignment.id)) synced++;
    }
  }
  log(
    synced > 0 ? `${synced} assignments synced with the exercise` : "assignments already in sync",
  );

  // Enough exercises for the catalog to be a catalog (T-020).
  const fillersCreated = await ensureCatalogExercises(admin.token, g1.id);
  log(
    fillersCreated > 0
      ? `created ${fillersCreated} catalog exercises`
      : "the catalog exercises already existed",
  );

  // A second author, so "only mine" is a filter with two sides (G-018).
  const supervisorExercises = await ensureAuthoredExercises(supervisor1.token, g1.id);
  log(
    supervisorExercises > 0
      ? `created ${supervisorExercises} exercises authored by the supervisor`
      : "the supervisor's own exercises already existed",
  );

  log("done");
  log(
    "NOTE: this dev machine's isolate sandbox cannot run cgroup v1 (see the compose repo's README.md) -- " +
      "submissions above will resolve to an infrastructure evaluation-failure state here, not genuine " +
      "pass/fail. Re-verify pass/fail states on a cgroup v1 host (production, or a fixed local Docker config).",
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
