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
  content: string,
): Promise<{ id: string }> {
  const form = new FormData();
  form.append("file", new Blob([content], { type: "text/plain" }), filename);
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
  const results = await api<{ items: { name: string; id: string }[] }>(
    "GET",
    "/exercises?limit=1000",
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
  await api("POST", `/exercises/${id}/environment-configs`, {
    token: adminToken,
    body: { environmentConfigs: [{ runtimeEnvironmentId: "python3", variablesTable: [] }] },
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
  return result;
}

async function submitSolution(
  studentToken: string,
  studentId: string,
  assignmentId: string,
  note: string,
  code: string,
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

  const upload = await apiUpload(studentToken, "/uploaded-files", "solution.py", code);
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

async function main() {
  log(`seeding against ${API_BASE}`);

  const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const instances = await api<{ id: string }[]>("GET", "/instances", { token: admin.token });
  const firstInstance = instances[0];
  if (!firstInstance) throw new Error("GET /instances returned no instances.");
  const instanceId = firstInstance.id;

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
