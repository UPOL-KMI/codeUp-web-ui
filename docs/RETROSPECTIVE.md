# ReCodEx New Frontend — Retrospective

**Status:** P-008, the last ticket of the plan
**Date:** 2026-09-02
**Written from:** `PROGRESS.md`, `DECISIONS.md`, `QUESTIONS.md`, `DROPPED.md`, `BACKLOG.md` and
`INVENTORY.md` — not from memory, which is why every claim below cites the entry it came from.

Brief §13 asks for this document and says why the citations are compulsory: _"A retrospective
written from a compacted context without citations is generic and worthless; the citation
requirement is what forces it to be specific."_ So every item names a ticket, a decision id, a
question id, or a file and line. Where a claim could be re-checked against the tree, it was.

It is long. That is deliberate: sections 1 and 4 are the parts the ReCodEx team cannot get by
reading the code, and thinning them to fit a page would remove exactly what makes them useful. Read
section 1 if you maintain core-api, section 4 and 6 if you are deciding what this frontend does
next, and section 5 before anybody puts it in front of students.

**Where the project stands as this is written.** Every feature ticket of Phases 1–6 is done, and
Phase 7 — the parity sweep and the polish passes — is done with it. That did not finish the product,
and the most useful thing this document can tell you is why. The parity sweep found **65 of 138
inventory rows carrying a wrong status** and **29 capabilities the legacy app has and this one does
not**; the accessibility pass applied 56 findings across 103 files; the performance pass applied 15
and filed 5 more with the bytes measured; the Czech review corrected 176 strings. So the app is
feature-complete against its plan and **not at parity against the product it replaces** — those turn
out to be different statements, and Phase 7 is what made the difference visible. The work that
remains is G-001…G-029 and PF-001…PF-005 in `BACKLOG.md`, ranked in section 6.

---

## Read this first

Eight things, if you read nothing else.

1. **The API publishes no response schemas — none, anywhere.** `swagger.yaml` is 7409 lines in which
   all ~250 responses are literally `description: 'Placeholder response'`, and the spec is not even
   served over HTTP. Every client of core-api is therefore maintaining a private, unversioned guess
   at every payload, this app included. One schema pass would turn a whole class of runtime
   surprises into compile-time errors for every consumer, forever. It is the highest-leverage change
   on this list. (§1.1)

2. **`permissionHints` is emitted for exactly one entity in the entire API.** The brief's rule is
   that a frontend offers an action only when the entity's hint says so. That is impossible for most
   of this product, so five screens restate core-api's own ACL rules by hand — five places that will
   silently be wrong the day `permissions.neon` changes. (§1.3, §1.4)

3. **This app reads well and writes badly, and that is a scoping failure rather than an accident.**
   P-001 found 29 capabilities the legacy app has and this one does not; **fourteen are a single
   control over an endpoint the repo already types and never calls.** A ticket that said "the X
   screen" was read as "render X", and the actions on that screen went with the screen instead of
   becoming tickets. (§3.1, §4.1)

4. **Three things a person simply cannot do here.** A group cannot be created, so a course cannot be
   started at all. A teacher cannot override a solution's points, accept it, re-run it or delete it.
   A shadow assignment cannot be created or edited — `scripts/seed.ts` is currently its only user
   interface. (§4.2, §4.4)

5. **The dashboard has a queue that nothing can fill.** S-002 built the teacher's "reviews students
   have asked for" list; `reviewRequested` is read in four places and written in none. It is the
   cheapest fix in the backlog and it turns an already-shipped screen from decorative into working.
   (§4.3, §6.2)

6. **Nothing in the evaluation half of the product has ever rendered a passing test.** The
   development host is cgroup v2, so no submission can succeed on it. The solution screen's result
   table, the live-progress island, the teacher's class summary and the "fully solved" state have
   been built, reviewed and shipped without anyone ever seeing them display a success. That is the
   first thing to check on a host that can run the sandbox. (§2.2, §3.3, §5.1)

7. **Not one email has ever left this deployment**, so every verification, reset and invitation flow
   was proved by minting a JWT with the instance's own signing key rather than by reading a message.
   The request/response halves are verified; the delivery half is untested by construction. (§3.4,
   §5.3)

8. **Every Czech string in the product is unreviewed by a Czech speaker**, and the only automated
   check — key parity between `en.json` and `cs.json` — cannot see a translation that is merely
   wrong. (§3.13, §5.4)

The one thing to do before anything else: **G-008, creating a group.** Every other ranking argument
in section 6 bends around it, including the Phase 8 importer, which would import courses into an app
where a course cannot exist.

---

## 1. API change requests

Twenty-seven API change requests, every one of them traced to a ticket that hit it while building a real screen against the live instance. (Entries 1.25-1.27 were added after the retrospective was first written, by the sessions that made evaluation work: they are what running real submissions through the API found, and the count above had said twenty-three while the list held twenty-four.) They fall into five kinds. **The contract itself is missing**: core-api's 7409-line `swagger.yaml` carries zero response schemas across ~250 operations and is not served over HTTP at all, so every frontend maintains a private guess at every payload — and the exercise-configuration vocabulary, the hardest part of the product, is published nowhere and now exists in three hand-copied versions. **Permission hints are absent almost everywhere**: `permissionHints` is emitted for exactly one entity in the entire API (`GroupFormat`), so five screens had to restate ACL rules the brief explicitly forbids them from restating. **Collection endpoints are inconsistent and silently permissive**: paging exists on some and not others, `/groups` returns a bare array where `/users` and `/exercises` return an envelope, `/users` takes `filters[search]` where the others take `search`, and an unrecognised parameter is ignored with an HTTP 200 — which shipped two real bugs whose output looked plausible enough to survive for weeks. **Three outright defects were reproduced with `curl` against the live instance**: a 500 with a raw Doctrine exception when an address is deleted a second time (Q-021), a licence validity flag that can be set true and never false because of a PHP truthiness test (Q-022), and an instance deletion that leaves its root group orphaned and still listed (Q-023). And **a set of missing verbs and missing fields** — no assignment collection, no bulk anything, no logout, no un-verify, no un-resolve, no way to validate an invitation token, no `admin` key on a user's groups — each of which cost this project either a round trip, a workaround, or a capability. The single highest-value item is the first: schemas on the responses. The single most damaging one found is the fifth: `/v1/users/{id}/groups` omitting administered groups meant the teacher sidebar had never rendered for anybody on this deployment, and nothing could have caught it.

### 1.1 The published API contract has no response schemas at all, and is not even served

core-api's `swagger.yaml` is 7409 lines with **zero response schemas anywhere**: all ~250 response definitions are literally `description: 'Placeholder response'`, no `content`, no `schema`, and no `components.schemas` section at all. Confirmed directly by F-022 while evaluating `openapi-typescript`/`openapi-fetch`: request bodies and path params generate real, useful types (`issue-restricted-token`'s generated `scopes: unknown[]` matched the hand-written Zod schema exactly), but every response resolves to `never`. The consequence is that `openapi-fetch`'s entire value proposition evaporated and this app hand-wrote every response type in `lib/api/`, typing only `path` against `keyof paths`. Separately, the spec is not reachable over HTTP at all on this deployment: `repos/api/docs/swagger.yaml` exists in the api source tree, but the nginx site config only exposes `www/`, so `docs/` 404s — the spec had to be vendored into this repo as `openapi/core-api.yaml` for codegen to work at all. Every response type in this frontend is therefore a second, unversioned copy of a contract core-api never published, and it will drift silently.

**What would fix it.** Add real response schemas (`components.schemas` + `content.application/json.schema`) to the ~250 operations in `docs/swagger.yaml`, and add an nginx location so the spec is served from the running API.

**Why it matters.** Highest-leverage item in this list. Every other consumer of core-api — this app, the legacy app, SIS integrations — is maintaining a private guess at the response shapes. One schema pass turns a whole class of runtime surprises into compile-time errors for every client, forever.

_Cited from:_ `F-022`, `Q-010`, `DEC-044`, `docs/PROGRESS.md:1619-1636`, `docs/PROGRESS.md:1626`, `docs/QUESTIONS.md Q-010 (Resolved table)`

### 1.2 The exercise-configuration endpoints publish no schema and no vocabulary — the hardest screen in the product is built on a hand-copied table

Every endpoint T-009's configuration editor reads and writes — `/v1/exercises/{id}/tests`, `/config`, `/environment-configs`, `/score-config`, `/config/variables` — is a `"Placeholder response"` with no response schema, and the request bodies are `type: array, items: {}`. Worse than the missing schema is the missing vocabulary: which variables exist (`expected-output`, `judge-type`, `success-exit-codes`, …), what their types are, which pipeline each belongs in, and which nine judge programs are built in, is published **nowhere**. core-api validates against it; the legacy frontend hard-codes it in `helpers/exercise/configSimple.js`; this app now carries a third copy in `lib/exercise-config/`. The one part that _is_ published is a pipeline's `parameters` (`hasEntryPoint`, `hasSuccessExitCodes`, `isCompilationPipeline`), which is exactly what made deciding _where_ a variable goes possible without guessing — proof that publishing the rest would work. Two consequences already: T-024 found that core-api refuses a configuration holding a variable the pipeline does not declare (`Variable 'extra-files' is redundant in pipeline …`), a rule nothing documents and which only surfaced by breaking it; and the `data-linux` and `haskell` descriptor variants and the five exclusive environments have **never been rendered** because this deployment installs none of them.

**What would fix it.** Publish real schemas on those five operations and add an endpoint that serves the descriptor table itself — the list of configuration variables, their types, their pipelines and the built-in judges — so no frontend has to carry a copy.

**Why it matters.** High. This is the screen the brief calls the hardest in the product, and its correctness rests entirely on a table copied out of the legacy JavaScript. An environment or variable added to core-api will not appear here until somebody notices.

_Cited from:_ `Q-020`, `T-009`, `T-024`, `DEC-101`, `DEC-102`, `docs/QUESTIONS.md:264-291`, `docs/PROGRESS.md:392-406`, `docs/PROGRESS.md:605-630`

### 1.3 `permissionHints` is emitted for exactly one entity in the whole API

The brief's rule (§3.4) is that this app decides what to offer from `permissionHints` on the entity, never from the reader's role name. That turns out to be impossible for most of the product: `permissionHints` is emitted for **exactly one entity in the entire API** (`GroupFormat`). `/v1/users/{id}` returns `permissionHints: null` even for a superadmin reading a student — verified live — because core-api gates _fields_ instead (`privateData` is built only under `canViewPrivateData`; `/v1/users/{id}/groups` simply 403s under `canViewGroups`). The result is two screens that had to fall back to exactly what the brief forbids: S-021's profile renders whichever rows arrived and _attempts_ the group list, reading a 403 as "not disclosed to you"; AD-001's user list offers Disable/Delete/Create on the **reader's global role**, with the only honesty guarantee being that the Server Actions call core-api on the caller's own token so the button and a forged call meet the same check. A comment carries no hint either, so S-018/T-022's delete and unhide controls are offered on a restated rule (`isAuthor` or supervising the group).

**What would fix it.** Emit `permissionHints` on every view-factory output — users, comments, solutions, assignments, exercises — the way `GroupFormat` already does.

**Why it matters.** High, and structural. Every screen that cannot read a hint is a screen where this app has reimplemented an ACL rule that is free to drift from `permissions.neon` on the next core-api release.

_Cited from:_ `DEC-080`, `DEC-110`, `S-021`, `AD-001`, `T-022`, `docs/DECISIONS.md:105`, `docs/DECISIONS.md:135`, `docs/PROGRESS.md:705-710`, `docs/PROGRESS.md:3120-3123`, `docs/PROGRESS.md:680-682`

### 1.4 Hints for rules whose subject is a _person_ are absent entirely, not false

A second, distinct hint gap, hit five separate times and each time recorded as "DEC-090's shape". Where an ACL rule is written against both an object and a subject, core-api computes the hint for the object alone and has nobody to put in the subject slot, so the key is **missing rather than `false`**: (1) `addStudent`/`removeStudent` are absent from a group's `permissionHints` entirely — confirmed live, keys missing — because the rules read `student.isSameUser`, `student.isNotGroupLocked`; (2) attaching and detaching a group to an exercise have no hint, both rules being written against the exercise _and_ the group; (3) `canViewStudentStats` is written against the student as well as the group, so T-005's per-student solutions page has no hint to read; (4) no hint for deleting or unhiding a comment; (5) `acceptInvitation`'s two extra conditions in `checkAccept` (link not expired, group not organizational) ride on no hint. Each time, this app restated core-api's own conditions from fields the page already holds — five hand-copied ACL fragments in a codebase whose stated rule is never to copy one.

**What would fix it.** Emit subject-relative hints where the subject is known (e.g. `permissionHints.addStudent` computed for the current user on a group payload), or publish a small "may I do X to Y" probe endpoint so a frontend can ask instead of restating.

**Why it matters.** High. Five restated ACL rules is five places this app will be wrong the day `permissions.neon` changes, and there is no test on either side that would catch it.

_Cited from:_ `DEC-090`, `DEC-083`, `S-026`, `T-005`, `T-008`, `T-022`, `S-023`, `docs/DECISIONS.md:115`, `docs/PROGRESS.md:3316-3321`, `docs/PROGRESS.md:55-57`, `docs/PROGRESS.md:226-229`, `docs/PROGRESS.md:3170-3186`

### 1.5 `/v1/users/{id}/groups` does not report the groups you administer — it broke shipped code silently

The single most consequential missing field found in the project. `UsersPresenter::actionGroups` returns `student` and `supervisor` keys, and `supervisor` is `User::getGroupsAsSupervisor()` — one specific membership type. A user who **administers** a group appears in neither list. Because of that, D-014's "My Teaching" sidebar section had **never rendered on this instance for anybody**: not for `sasha.mentor` (admin of Large Lecture, and the brief's own "one person, two audiences" persona), not for the superadmin (admin of all four seeded groups). An absent optional section looks exactly like a correct one, which is why nothing caught it for weeks; it was found only because the author's own teacher slot was untestable. The fix costs a second whole-instance request on every render: `getMyGroups()` now unions the `supervisor` list with every group from `GET /v1/groups` whose `privateData.admins` contains the caller — the same derivation the legacy app makes. The rejected alternative, `primaryAdminsIds` on the `/groups` payload, is present only for groups already in one of the two lists, i.e. exactly the case that fails.

**What would fix it.** Add an `admin` key to `GET /v1/users/{id}/groups` alongside `student` and `supervisor`.

**Why it matters.** High. One missing key cost a permanent extra whole-instance fetch per render and shipped an invisible, undetectable bug into the sidebar of every teacher on the deployment.

_Cited from:_ `DEC-058`, `S-001`, `D-014`, `docs/DECISIONS.md:83`, `docs/PROGRESS.md:2428-2437`

### 1.6 There is no assignment collection endpoint at all

core-api has no `/v1/assignments` collection and no `/search`. Verified against the generated OpenAPI paths _and_ the live instance, not assumed. Two costs, both shipped. First, D-015's command palette cannot search assignments: `docs/IA.md` §3.4 asks for "Assignments (by name, within groups)" and `search` query parameters exist only on `/v1/users`, `/v1/exercises` and `/v1/groups`, so assignment search was not built at all and is recorded as Q-011 rather than faked. Second, S-001's student dashboard has to fan out one `GET /v1/groups/{id}/assignments` **per group** to build the upcoming-deadlines panel — the "how am I doing" half costs zero extra requests because it rides on the `stats` array the sidebar already fetches, but the deadlines cost one request per group, and S-002's teacher panel does the same across every taught group.

**What would fix it.** Add `GET /v1/assignments` with `search`, a `groupIds[]` filter and paging, so a deadline panel is one request and an assignment can be found by name.

**Why it matters.** High. It is simultaneously a lost capability (search) and the single largest source of request fan-out on the app's landing page.

_Cited from:_ `Q-011`, `D-015`, `S-001`, `S-002`, `docs/QUESTIONS.md:48-63`, `docs/PROGRESS.md:2316-2320`, `docs/PROGRESS.md:2426-2427`

### 1.7 No bulk operations anywhere, so every multi-target action is a loop of requests

T-012's "assign this exercise to several groups" is one request per group because **core-api has no bulk call** — the screen was designed around it, so a reader who may create in four of the five groups they picked gets four assignments and one named refusal rather than a single opaque error. S-025's shadow-assignment rows are one `GET /v1/groups/{id}/shadow-assignments` per group, fanned out the same way the deadline table already fans out. The teacher dashboard's third IA-mandated section ("recent activity — new submissions, comments") was **not built at all** because assembling it means one request per assignment across every taught group: **27 requests for the seeded superadmin alone**, unbounded for a real teacher, on the landing page, to produce a list most of whose rows would be discarded.

**What would fix it.** Accept id lists on the read endpoints that are fanned out today (`groupIds[]` on assignments and shadow-assignments) and add a bulk-create body to `POST /v1/exercise-assignments` that reports per-group outcomes.

**Why it matters.** High for the dashboard, which is the first screen every user sees; medium elsewhere. The 27-request figure is measured, not estimated.

_Cited from:_ `T-012`, `S-025`, `S-002`, `Q-013`, `docs/PROGRESS.md:500-504`, `docs/PROGRESS.md:3249-3251`, `docs/QUESTIONS.md:89-107`, `docs/PROGRESS.md:2506-2510`

### 1.8 Collection endpoints are inconsistent: some page, some don't; some take `filters[x]`, some take `x`; and unknown parameters are ignored in silence

Four distinct inconsistencies, all found live, two of which shipped as bugs. (1) **Paging is arbitrary.** `/v1/exercises` and `/v1/users` are genuinely paginated with `{items, totalCount, offset, limit}`; `GET /v1/groups` offers `search` but **no paging** (checked), so S-004 fetches every group the caller can see and filters in the browser; `/v1/exercise-assignments/{id}/solutions` has no paging either, so T-003 does the same; the submission-failure history is "unbounded and unpaginated" and this instance is already at fifty-odd rows. (2) **Envelopes disagree between three endpoints used in one feature**: `/users` and `/exercises` return the paginated envelope while `/groups` returns a bare array — D-015's route normalises it so the inconsistency never reaches the UI. The seed script hit the same thing as a runtime `TypeError`. (3) **Filter naming disagrees**: `/v1/users` takes `filters[search]` and `/v1/groups` and `/v1/exercises` take a bare `search` (re-checked live rather than assumed). (4) **Both whitelists fail silently**: a bare `search` on `/v1/users` is ignored and the endpoint answers with every user it would have returned anyway, and `orderBy=bogus` answers HTTP 200 with the rows in arbitrary order. The command palette had been listing arbitrary users since D-015 — plausible-looking output, which is exactly why it survived — and T-001's exercise picker had a search box that did nothing and a "matched" count that was the size of the whole catalog (`filters[search]=zzz` answers `totalCount: 0`; `search=zzz` answers everything).

**What would fix it.** Reject unknown or unwhitelisted query parameters with a 400 instead of ignoring them, and make one filter convention and one list envelope apply to every collection endpoint; add paging to `/v1/groups` and to the assignment-solutions and submission-failure lists.

**Why it matters.** High. Two real shipped bugs came from (4) alone, and both produced _plausible_ wrong output — the worst kind. The paging gap is the one thing that makes this app's client-side-filtering trade wrong on an instance with thousands of groups.

_Cited from:_ `DEC-076`, `Q-015`, `D-015`, `T-001`, `T-003`, `T-019`, `S-004`, `docs/DECISIONS.md:101`, `docs/QUESTIONS.md:135-153`, `docs/PROGRESS.md:140-146`, `docs/PROGRESS.md:714-716`, `docs/PROGRESS.md:3025-3031`, `docs/PROGRESS.md:2321-2324`, `docs/PROGRESS.md:3379`, `docs/PROGRESS.md:115-116`, `docs/PROGRESS.md:1216-1218`

### 1.9 Write semantics are ad hoc and undocumented: some endpoints replace the whole entity, one appends, and renaming a test changes its id

There is no partial update anywhere, and the exceptions to that rule are the surprising ones. **Replace-everything**: `actionUpdateDetail` replaces an assignment with what it is sent, so a field omitted is a field reset and every save must carry every field (DEC-092); `updatePipeline` replaces the whole entity, which is why T-015 and T-016 had to become one screen instead of the legacy app's two, each re-reading the other half on every save; a group's `localizedTexts` array is replaced wholesale, so the form has to submit every locale at once and a blank name can only mean "delete this language" (DEC-075); `POST /v1/instances/{id}`'s entire request body is `{isOpen}`. **Append-not-replace**: `POST /v1/exercises/{id}/tests` _adds_ rather than replaces, so the seed script failed on re-run with "test name 'Test 1' is already taken" until it learned to send the existing test's id. **Identity is not stable**: renaming a test changes the test's **id**, because core-api copies a test rather than updating it and rewrites the configuration to point at the copy — which is the reason T-009's screen is three forms in strict dependency order, each refreshing the page after it saves, with the third not rendered at all until the first two are done.

**What would fix it.** Document the replace-vs-append semantics per endpoint in the spec, support partial update (PATCH) on the large entities, and make a test rename preserve the test's id rather than creating a copy.

**Why it matters.** Medium-high. The whole-entity replacement is survivable once known; the id-changing rename is what makes the product's hardest screen structurally awkward, and the appending tests endpoint silently broke idempotency of the seed script.

_Cited from:_ `DEC-092`, `DEC-075`, `DEC-113`, `T-002`, `T-009`, `T-015`, `T-016`, `F-025`, `docs/DECISIONS.md:117`, `docs/PROGRESS.md:396-399`, `docs/PROGRESS.md:573-575`, `docs/PROGRESS.md:1210-1211`, `docs/PROGRESS.md:840-845`, `docs/PROGRESS.md:3019-3024`

### 1.10 DEFECT: an address that has been deleted once can never be deleted again (HTTP 500, raw Doctrine exception)

Deleting a user is a soft delete with anonymisation: `AnonymizationHelper::prepareUserForSoftDelete` rewrites the account's address to `<address>@deleted.recodex` — one fixed suffix from `config.neon`'s `anonymization.deletedEmailSuffix` — and the `email` column's unique index still covers soft-deleted rows. So an address survives that transformation exactly once. Create `a@b.c`, delete it, create `a@b.c` again (core-api allows this: its free-address check reads the soft-delete-filtered repository, so the address genuinely is free), then delete it again and it dies with `HTTP 500 {"code":500,"error":{"message":"Unexpected Error Doctrine\\DBAL\\Exception\\UniqueConstraintViolationException","code":"500-000"}}`. Reproduced straight against core-api with `curl`, not only through this app. The account stays fully usable and the administrator is shown a PHP class name. Found by `e2e/users.spec.ts` on its second run, once the first run had consumed the fixed probe address; the spec now mints a per-run address, which is a workaround for the test and not for the product. Operator workaround: change the account's address via `POST /v1/users/{id}` to something not yet deleted, then delete.

**What would fix it.** Make the anonymised address collision-proof — append the user's uuid rather than a constant suffix — or catch the constraint violation and answer something an administrator can act on.

**Why it matters.** Medium. Rare to want, trivially worked around, but it is a 500 with a raw ORM exception shown to an administrator, which is the exact shape of bug that erodes trust in the whole admin surface.

_Cited from:_ `Q-021`, `AD-001`, `docs/QUESTIONS.md:292-325`, `docs/PROGRESS.md:742-748`

### 1.11 DEFECT: a licence can be marked valid by any client and invalid by none

`POST /v1/instances/licences/{licenceId}` publishes an `isValid` field documented as an "Administrator switch to toggle license validity". It cannot toggle it. `InstancesPresenter::actionUpdateLicence` reads it as `$isValid = $req->getPost("isValid") ? filter_var(..., FILTER_VALIDATE_BOOLEAN) : $licence->isValid();` — `false` is falsy in PHP, so it takes the else branch and writes back the value the licence already had. Everything else that would survive the truthiness test is rejected first by the boolean validator. Reproduced all three ways with `curl` against the live instance: `{"isValid": false}` → HTTP 200, unchanged; `{"isValid": "false"}` → HTTP 400 "did not pass the validation of type 'boolean'"; `{"isValid": 0}` → HTTP 400. The same falsy-test shape (`?:`) covers `note` and `validUntil` in that method, where an empty note or date silently keeps the old value instead of clearing it. AD-008 built a Revoke control on the strength of the published field, its own e2e spec caught it doing nothing, and the control was deleted — which is also the explanation for the legacy frontend rendering a read-only column titled "Without revocation" and offering no way to change it. That was understood as an oversight until building the button explained it.

**What would fix it.** Test `$req->getPost("isValid") !== null` instead of truthiness, and do the same for `note` and `validUntil`.

**Why it matters.** Medium. Nothing is blocked (an unwanted licence can be deleted), but a published, documented API field that silently no-ops is worse than an absent one, and it has already cost two frontends the same capability.

_Cited from:_ `Q-022`, `AD-008`, `docs/QUESTIONS.md:326-362`, `docs/PROGRESS.md:848-855`

### 1.12 DEFECT: deleting an instance orphans its root group

`InstancesPresenter::actionDeleteInstance` removes the instance row and stops — three lines, `findOrThrow`, `remove`, `flush`. The instance's **root group**, created by `actionCreateInstance` from the name and description and the ancestor of everything in that instance, is not touched. It survives with no instance to belong to, keeps appearing in `GET /v1/groups`, and keeps appearing in the sidebar of whoever administers it. Found by looking at a sidebar: after four runs of AD-004's e2e spec the superadmin's "My teaching" section listed **eight** groups named `e2e instance …` and `e2e licence …` while the instance list showed one row. All eight were removable through `DELETE /v1/groups/{id}`, so nothing was wedged — they were simply garbage nobody had a reason to look for. This app's response was not to delete the group as a second call (a two-call delete can half-succeed, and removing a group tree is a far larger destructive act than the endpoint promises): the confirmation dialog now states that the instance goes and the root group stays.

**What would fix it.** Cascade the root group's removal in `actionDeleteInstance`, or refuse to delete an instance whose root group still has children.

**Why it matters.** Medium. Silent data litter in a multi-tenant structure, invisible until somebody counts sidebar rows — and the app has to warn about it in a destructive dialog, which is a bad place to explain a backend wart.

_Cited from:_ `Q-023`, `AD-004`, `AD-006`, `docs/QUESTIONS.md:363-397`, `docs/PROGRESS.md:900-908`

### 1.13 Error responses: a 500 for a shape mistake, a misleading 400 for an unrouted path, and a message that contradicts the request

Four separate error-semantics problems, each found live. (1) `localizedStudentHints` sent as `[{locale, text}]` causes a **PHP 500 (TypeError)** — it wants a locale-keyed object `{en: "…"}`, and the only tell was the swagger description's `(locale => hint text)`. A wrong request body shape should be a 400. (2) Any unrouted path answers `{code: "400-000", message: "Bad Request"}` — Nette's generic routing-exception fallback — which reads at a glance like an ACL or validation failure rather than "no such endpoint"; F-022 lost time to a `/v1/v1/users/...` URL for exactly this reason. (3) A superadmin forcing a password change on **their own** account gets `400-103 "Your current password does not match"` — a confusing sentence for a request that contained no password to not match; the real rule is an `allow: false` sitting above the superadmin's blanket allow in `permissions.neon`. (4) `/v1/groups/{id}/students/{userId}/...` answers **400, not 404**, for "this person does not study here", which T-005 has to special-case as `notFound()` in one module because for every other endpoint a 400 really is a bug in the request.

**What would fix it.** Validate request-body shapes and answer 400 with a field-level message instead of letting a TypeError become a 500; answer 404 with a distinguishable code for unrouted paths and for "entity not in this relation"; give the self-forced-password-change refusal its own message.

**Why it matters.** Medium. None of these block a feature, but each one cost real debugging time and each one teaches a client to distrust the status code it was given.

_Cited from:_ `F-025`, `F-022`, `AD-002`, `T-005`, `docs/PROGRESS.md:1207-1209`, `docs/PROGRESS.md:1651-1654`, `docs/PROGRESS.md:765-770`, `docs/PROGRESS.md:58-60`

### 1.14 The forgotten-password endpoint is an account-existence oracle

`ForgottenPasswordPresenter::actionDefault` throws `NotFound` for an unknown login. Passing that through to the UI would turn the reset form into an oracle — type addresses, read which ones exist on this instance — so A-004's route deliberately swallows the 404 and the page says "if we know that address, a message is on its way" for every input. The frontend is papering over a backend behaviour here; the endpoint itself still answers differently for a known and an unknown address to anything that calls it directly, including the legacy app and any script.

**What would fix it.** Answer 200 for every address on `POST /v1/forgotten-password`, whether or not the login exists.

**Why it matters.** Medium. A low-severity enumeration primitive, but it is the kind that gets found by an audit rather than by a user, and the fix is one line in the presenter.

_Cited from:_ `DEC-100`, `A-004`, `docs/DECISIONS.md:125`, `docs/PROGRESS.md:277-280`

### 1.15 There is no logout endpoint, and refreshing does not invalidate the old token

Confirmed against `docs/swagger.yaml`: only `/login`, `/login/refresh` and `/login/takeover` exist — core-api has **no logout or token-invalidation endpoint at all**, and the legacy app's own logout is a pure local Redux action with no API call. So signing out of this app clears its httpOnly cookie and tells core-api nothing; the token stays valid for the remainder of its life (7 days by default). Compounding it, F-018's first live test of `/login/refresh` found that **refreshing does not invalidate the old token** — both the pre- and post-refresh tokens kept working — which downgrades the brief's stated failure mode from "the two tokens invalidate each other" to "a wasted upstream call", but also means a refresh cycle multiplies live tokens rather than rotating them. (A related discovery: core-api's JWTs are second-granularity deterministic — HMAC-SHA256 over a payload whose only varying claim is `iat` — so two refresh calls in the same wall-clock second produce a byte-identical token, which quietly invalidates any de-duplication test that compares token values.)

**What would fix it.** Add `POST /v1/login/invalidate` (and invalidate the presented token on `/login/refresh`), so a sign-out and a rotation actually revoke.

**Why it matters.** Medium-high as a security property: a stolen or logged-out token cannot be revoked by any client, only by an administrator ending every session of that account.

_Cited from:_ `F-017`, `F-018`, `DEC-040`, `docs/PROGRESS.md:1457-1459`, `docs/PROGRESS.md:1493-1503`, `docs/BACKLOG.md:40-41`

### 1.16 Operations with no inverse: five capabilities that can be turned on and never off

A pattern, not one endpoint. (1) **Email verification cannot be undone** — there is no endpoint that un-verifies an address, so A-006's end-to-end verification had to be run on a throwaway filler account rather than a seeded persona. (2) **Resolving a submission failure is permanent** — core-api has no un-resolve, so T-019 made it a dialog with a typed note rather than a one-click button, and defaults the notification email to off because an email is the irreversible half of an already irreversible action. (3) **A licence cannot be revoked** (Q-022 above). (4) **An iCal calendar token cannot be deleted** — expiring is the only revocation core-api offers, the record stays marked, so S-022 lists expired links rather than letting them disappear. (5) **Nothing can delete plagiarism data** — a batch, its similarities and its fragments are permanent once uploaded, which is why S-019's fixture is seeded once and read by the e2e suite rather than uploaded per run.

**What would fix it.** Add the inverse operation for each: un-verify an address, reopen a submission failure, revoke a licence (Q-022), delete an iCal token, delete a plagiarism batch.

**Why it matters.** Medium. Each one individually is a small missing verb; together they make the product feel like a system where mistakes are permanent, and they force awkward UI (typed-confirmation dialogs, tombstoned rows) on the frontend.

_Cited from:_ `A-006`, `T-019`, `S-022`, `S-019`, `Q-022`, `docs/PROGRESS.md:330-334`, `docs/PROGRESS.md:117-121`, `docs/PROGRESS.md:3155-3157`, `docs/PROGRESS.md:3067-3070`

### 1.17 A student's assignment status cannot distinguish "never submitted" from "every attempt failed"

`GET /v1/users/{id}/groups`' `stats` array reports, per assignment, the status of the student's **best** solution — and core-api builds that from _valid_ solutions only (`AssignmentSolutions::findBestUserSolutionsForAssignments` → `findValidSolutionsForAssignments`). A student whose every attempt hit an infrastructure failure has no best solution, no status (`null`) and no points, which is indistinguishable in this payload from a student who has never opened the assignment. Visible right now on the seeded data: `alice.student` has four submitted solutions across two assignments, every one an `evaluation_failure`, and the dashboard shows both as **Not submitted**. The legacy dashboard shows the same thing for the same reason. The workaround exists but costs a request: `/v1/assignment-solvers?groupId=&userId=` returns `lastAttemptIndex` and `evaluationsCount`, which is exactly how S-013's class summary fixes the same number for a teacher (DEC-068) — eleven attempts and no scored solution now reads "Evaluation failed" there while the dashboard still says "Not submitted".

**What would fix it.** Include the attempt count (or a distinct status such as `all-failed`) in the per-assignment `stats` rows on `GET /v1/users/{id}/groups`.

**Why it matters.** Medium. Two screens in the same product give different answers about the same student, and the wrong one is on the landing page. It is invisible on a healthy worker, which is precisely why it will stay unfixed.

_Cited from:_ `Q-012`, `S-001`, `S-013`, `DEC-068`, `docs/QUESTIONS.md:65-88`, `docs/PROGRESS.md:2438-2442`, `docs/PROGRESS.md:2884-2890`, `docs/DECISIONS.md:93`

### 1.18 An invitation token cannot be validated without spending it

`/accept-invitation` renders the invited person's name, email and the invitation's dates straight out of the JWT in the URL. It does not verify the signature and **it has no way to**: core-api signs with `accessManager.verificationKey`, which this app deliberately does not hold (§5, DEC-085), and there is no endpoint that will validate an invitation token on a client's behalf — checked against the whole of `openapi/core-api.yaml`, not assumed. Nothing is granted on the strength of what the page displays (`POST /v1/users/accept-invitation` decodes with the real key and answers `400-000` for anything else), but anyone can craft a link on this deployment's own domain that shows an arbitrary name and email above a password field. The strings are rendered as text so there is no injection; the exposure is that the page looks legitimate because it _is_ the legitimate page. The legacy frontend has the identical gap — it decodes in the browser and checks only `exp`.

**What would fix it.** Add a read-only endpoint that answers "is this invitation token valid and unused" without creating anything — the same shape as the existing `users/validate-registration-data`.

**Why it matters.** Medium. A phishing surface on the institution's own domain, inherited by both frontends, closed by one small endpoint.

_Cited from:_ `Q-018`, `S-024`, `DEC-085`, `docs/QUESTIONS.md:210-236`, `docs/PROGRESS.md:3219-3224`

### 1.19 Whether local registration is open is not discoverable, so it has to be configured twice

core-api decides whether anybody may create their own account (`localRegistration.enabled`, from the compose repo's `LOCAL_REGISTRATION_ENABLED` — **false** on this deployment) and **publishes no endpoint that reports it** — checked against the whole spec. So a frontend that wants to know before rendering a form has to be told separately, which is why the legacy app carries its own `ALLOW_LOCAL_REGISTRATION` and why this app now does too. Two places to configure one fact, and they can disagree: say open while core-api says closed and a reader fills in a form only to meet "Forbidden Request — Access denied"; say closed while it is open and an account that could have been created is not offered. There is a knock-on: because the flag is off here, A-003's **success path has never been exercised at all** — the form, the "that address is taken" check and core-api's refusal are verified, but no account has ever been created through this screen and neither has the name-collision branch.

**What would fix it.** Publish it — an `isOpen`-style field on the already-public `/v1/instances`, or a small `GET /v1/registration-config`.

**Why it matters.** Medium. Small endpoint, removes a whole class of misconfiguration, and would let the registration screen be verified rather than assumed.

_Cited from:_ `Q-019`, `A-003`, `docs/QUESTIONS.md:237-263`, `docs/PROGRESS.md:362-368`

### 1.20 The IP half of an exam lock records infrastructure, not the student

Locking a student into an exam pins them to the address the lock request came from (`GroupsPresenter::actionLockStudent` reads `getRemoteAddress()`), and core-api then refuses every later request from any other address (`BasePresenter::verifyUserIpLock`). In this app the lock request is made by the **server**, so the recorded address is this app's container — the same for every student. This is not a BFF regression: in this deployment the legacy frontend does not record the student's address either, because the browser reaches core-api through the nginx `proxy` service which does set `X-Forwarded-For`, but core-api's Nette configuration **trusts no proxy** (there is no `http: proxy:` entry in the api repo's `config.neon`, checked), so `getRemoteAddress()` is the proxy container's address for every request. Both frontends record an infrastructure address; ours is a different one. The `groupLock` half — what "secured mode" actually means — works as intended, and S-008's UI is worded accordingly ("address recorded", not "student's address").

**What would fix it.** Configure core-api to trust the deployment's proxy (`http: proxy:` in `config.neon`) and decide who may set the forwarding header, so `getRemoteAddress()` returns the client rather than the nearest container.

**Why it matters.** Medium, and it is an operator/deployment decision rather than a code change — but as things stand the IP half of the exam lock provides no security anywhere, in either frontend, and the feature reads as if it does.

_Cited from:_ `Q-017`, `S-008`, `docs/QUESTIONS.md:182-209`, `docs/PROGRESS.md:2982-2989`

### 1.21 The monitor channel id is disclosed once, in the submit response, and never again

The WebSocket channel that carries live evaluation progress comes back only in the response to the submit that created the job; **no endpoint returns it later**. That single fact decided S-016's whole design: a socket cannot be the mechanism for a solution page opened at any other moment, which is most of them. So the page refreshes itself on a five-second server-side timer (`router.refresh()`, stopped when the tab is hidden and after five minutes), and the socket is layered on only where the id happens to exist — `submitSolution()` returns it and the submit form carries it forward as `?monitor=…&tasks=…`. The protocol itself was confirmed against a live job rather than from documentation (`DOWNLOADED`, `STARTED`, one `TASK` per task, then `FAILED`/`FINISHED`), and the monitor's five-minute replay is what makes it work at all given the page load sits between the submit and the connection.

**What would fix it.** Include the monitor channel id (and task list) on the solution/submission entity, so any client opening a pending solution can subscribe.

**Why it matters.** Medium. The capability was preserved by polling, but every open solution page currently pays a five-second server re-render for a fact the API already knows.

_Cited from:_ `S-016`, `DEC-065`, `docs/PROGRESS.md:2835-2848`

### 1.22 Fields computed from inputs the API does not publish, and sentinel values that lie

Three cases where a client cannot reason about what it was given. (1) **`hasValidLicence`** is computed as `needsLicence === false || validLicences > 0`, and `needsLicence` is **not published** — so the seeded instance reports itself covered with an empty licence table, which on its own reads as a contradiction; AD-005's screen has to tell the two apart by inference and say which in words. Found by rendering it, not by reading the entity. (2) **Which time measure an exercise means** is not recorded: core-api stores either `wall-time` or `cpu-time` limits and never says which, so T-010 reproduces the legacy heuristic (whichever key more limits carry, processor time on a tie) and then exposes it as a switch, because flipping it rewrites every cell. (3) **`secondDeadline` arrives as `0` rather than `null` when unset** (confirmed live), which without a guard produces a 1970 date and silently reports every such assignment as long closed; `pastDeadline` is likewise a count of seconds, not a boolean, and reads as `0` for a solution that was on time. (4) The broker's statistics are a flat map with no schema, so AD-006 renders core-api's raw counter names untranslated rather than a table that would go stale the first time the broker grows a counter.

**What would fix it.** Publish `needsLicence` alongside `hasValidLicence`, store and expose which time measure an exercise uses, emit `null` (not `0`) for an unset `secondDeadline`, and give the broker statistics a schema.

**Why it matters.** Medium. Each is small; together they are the reason several screens contain an inference the API could simply have answered, and the `0`-for-unset case is a live footgun for any client that does not guard it.

_Cited from:_ `AD-005`, `AD-008`, `T-010`, `S-001`, `AD-006`, `docs/PROGRESS.md:856-861`, `docs/PROGRESS.md:442-447`, `docs/PROGRESS.md:2450-2451`, `docs/PROGRESS.md:888-892`

### 1.23 Permission grants that strand a capability or hide data from the person who needs it

Four ACL shapes that made a screen either impossible or misleading. (1) **A supervisor can write a broadcast and never see it again**: `notification.create` is granted from the `supervisor` role up, but `viewAll` — the management list — is the superadmin's alone, so there is nowhere to see, edit or withdraw what you wrote. Building half a screen from `/v1/notifications` was rejected because that endpoint answers what is _active for the reader_, not what they authored. (2) **`/v1/reference-solutions/exercise/{id}` is filtered one solution at a time** by `canViewDetail`, so a supervisor sees an empty array for an exercise that demonstrably has reference solutions and is assignable — 8 rows for the administrator, 0 for a supervisor of the same exercise. Only the unfiltered `hasReferenceSolutions` flag on the exercise separates "nobody has written one" from "none of them is yours to read". (3) **`user.viewAll` is granted from `supervisor` upwards but a `supervisor-student` is refused the user list outright**, because that role inherits only `viewList` from student and never gains `viewAll` — not what "teachers see the user list" would predict. (4) `GET /v1/groups/{id}/members` is marked `@deprecated` ("Members are listed in group view") **and** omits observers — the endpoint being retired is also the one that answers less.

**What would fix it.** Align `notification.viewAll` with `create` (or add "notifications I authored"), publish an unfiltered reference-solution count, give `supervisor-student` `user.viewAll`, and replace `/members` with a non-deprecated endpoint that includes observers.

**Why it matters.** Medium. (1) is a capability with literally nowhere to reach it, which is worse than a missing feature; (2) makes an empty state a plain falsehood for the commonest reader.

_Cited from:_ `AD-007`, `T-011`, `AD-001`, `S-005`, `DEC-106`, `DEC-115`, `docs/PROGRESS.md:933-938`, `docs/PROGRESS.md:519-524`, `docs/PROGRESS.md:698-703`, `docs/PROGRESS.md:2618-2622`, `docs/DECISIONS.md:131`

### 1.24 Smaller shape problems that each cost a round trip, a workaround, or a wrong guess

Collected because none of them justifies its own paragraph but together they describe the texture of working against this API. **No `/users/me`** — passing `me` as the id fails core-api's own uuid validation, so every caller must know its own id first. **Groups, assignments and exercises carry no top-level `name`** — names come from a `localizedTexts` array keyed by locale, which needed a shared `localizedName` helper falling back to the first available translation rather than rendering an empty, unclickable row. **The role lives at `privateData.role`**, not at the top level. **No "review requested at" timestamp** — a review request is a boolean flag on the solution, so S-002's queue sorts by the solution's `createdAt` and labels the column "Submitted" rather than claiming a waiting time it cannot know. **No call creates and configures an assignment or an exercise in one step** (`actionCreate` takes an exercise and a group and applies its own defaults), which forced the create-first-configure-second flow in both T-001 and T-008. **Pipeline ids are assigned when the runtime package is imported**, so they differ on every fresh database — a hardcoded id verified live against one deployment was simply wrong everywhere else. **The pipeline list endpoint knows `search`, `exerciseId` and `authorId` and nothing about runtime environments**, so T-014's language filter is honestly local and says so. **Exercise edits use optimistic concurrency (`version`, error `400-010`)** which is right, but is documented nowhere the seed script's author found it. **`actionStartPartial` permits 1 GiB uploads** while this deployment's nginx and PHP cap at 512 MiB — the deployment, not the API, is the binding constraint, which is worth stating in the spec.

**What would fix it.** Add `/v1/users/me`; add a `name` convenience field (or a `?locale=` parameter) beside `localizedTexts`; record a `reviewRequestedAt` timestamp; accept an optional settings body on assignment and exercise creation; add a runtime-environment filter to the pipeline list; and document the `version` optimistic-lock convention and the real upload ceiling in the spec.

**Why it matters.** Low individually, cumulative in aggregate. These are the items a backend developer could clear in a week and that would remove a dozen small workarounds from every client.

_Cited from:_ `D-014`, `S-002`, `T-001`, `T-008`, `T-014`, `F-025`, `D-005`, `DEC-093`, `DEC-098`, `docs/PROGRESS.md:2294-2299`, `docs/PROGRESS.md:2500-2503`, `docs/PROGRESS.md:3431-3436`, `docs/PROGRESS.md:2358-2362`, `docs/PROGRESS.md:564-566`, `docs/PROGRESS.md:1213-1215`, `docs/PROGRESS.md:1964-1966`

### 1.25 Deleting a solution that plagiarism detection has touched destroys its files and then fails

`DELETE /assignment-solutions/{id}` answers **HTTP 500** with a raw
`Doctrine\DBAL\Exception\ForeignKeyConstraintViolationException` for any solution named in a detection record — two foreign keys do it (`plagiarism_detected_similarity.tested_solution_id` and `plagiarism_detected_similar_file.solution_id`) and neither cascades — and **there is no route that removes such a record**: `createPlagiarismRoutes` registers list, detail, create, update and add-similarities, and no `DELETE` at batch, similarity or file level. The state is terminal through the API in both directions. **What PF-016 added to this, by hitting it twice on the development instance, is that the failure is not clean:** the solution's stored files are removed _before_ the row deletion fails, and nothing puts them back. What is left is a solution that still lists its files through `GET /assignment-solutions/{id}/files` — name, size, uploader, all intact — whose bytes are gone: `download-solution` answers 404, the source viewer renders nothing, and no screen can say why. Recovering it needed two rows cleared straight in the database and a re-seed. So a delete that the API refuses has already destroyed data by the time it refuses.

**What would fix it.** Check the references **before** touching storage and refuse with a 4xx that names what holds the row — the way `checkDeleteSubmission` already refuses deleting the last evaluation run — and add a `DELETE` for plagiarism batches and similarities so the refusal is not permanent.

**Why it matters.** High, and higher than Q-029 alone reads. A 500 on an unsupported delete is an annoyance; a 500 that silently empties a student's submission is data loss, and the entity it leaves behind looks intact from every endpoint an app can ask.

_Cited from:_ `Q-029`, `Q-031`, `PF-012`, `PF-016`, `docs/QUESTIONS.md Q-029`, `docs/QUESTIONS.md Q-031`

### 1.26 A submission refused while its job is compiled still leaves the solution behind

`POST /exercise-assignments/{id}/submit` creates the `Solution` before it compiles the job configuration, so a submission refused at that point — a missing submit-time variable, or a `source-files` pattern that matched nothing — answers a clear 400 **and keeps the row**. It appears in the assignment's solution list with no evaluation, no points and no submission, indistinguishable at a glance from one still being evaluated. Seen three times while establishing PF-016, each needing deletion by hand.

**What would fix it.** Compile the job before persisting the solution, or roll the solution back when compilation refuses.

**Why it matters.** Medium. It is invisible until something submits invalid input deliberately — a test suite, a seed, an importer — and then it leaks one row per attempt into a list real people read. A note-based sweep only catches the ones that carry a prefix.

_Cited from:_ `Q-032`, `PF-016`, `docs/QUESTIONS.md Q-032`

### 1.27 A solution whose author was deleted makes the view factory throw

`/v1/exercise-assignments/{id}/solutions` reports a solution whose author is gone with `authorId: null` — a state core-api itself publishes — and reading that solution through the view factory then throws `AssignmentSolutionViewFactory.php:69`: `findBestSolution(): Argument #2 ($user) must be of type User, null given`. core-api already knows the case exists and guards it in one place; this is the place it does not.

**What would fix it.** Guard the null author in `AssignmentSolutionViewFactory`, the way the payload that publishes `authorId: null` already implies.

**Why it matters.** Medium. Deleting a user is ordinary administration, and it leaves endpoints that 500 for everyone afterwards. This app stopped rendering such a solver as a row (they reached the class-progress table as a person with no name whose link pointed at `/users/null`), but an endpoint that 500s is an endpoint that 500s.

_Cited from:_ `Q-030`, `PF-013`, `docs/QUESTIONS.md Q-030`

---

## 2. Where the build was hardest

Read against the log rather than against memory, the hard parts of this build were almost never the React. The five most expensive passages were: (1) an evaluation sandbox that cannot run on the development host at all, which left the single most important screen family in the product — solution results — never once rendered with real data; (2) core-api endpoints that publish no schema (the exercise configuration editor, which the brief itself called the hardest screen) or that publish a field they then ignore (three separate core-api defects, Q-021/Q-022/Q-023, all found by building a control and watching it do nothing); (3) three tools that lied in ways only running the thing exposed — the Next.js standalone file tracer, Playwright's `storageState` scoping, and `@viz-js/viz` crashing on a size threshold; (4) dev/production divergence, where `next dev` was green and the Docker build was not, twice; and (5) the project's own bookkeeping, which P-001 found had 65 of 138 parity-contract status cells wrong. Only one ticket is blocked, F-028, and it is blocked on an npm peer range nobody in this repo can move. The recurring shape across all of it: the code compiled, typechecked, linted and passed CI, and the defect was found by a person or a spec actually exercising the real system. Six times the log says a bug was "found live" in work that had already shipped.

### 2.1 The one blocked ticket is blocked on an npm peer range, and has been evaluated twice

F-028 asks to re-evaluate the TypeScript 7 / ESLint 10 pin that F-002 introduced. F-002 pinned `typescript@6.0.3` and `eslint@9.39.5` because `typescript-eslint@8.67.0` hard-errors on load against TS7 (its peer range is `>=4.8.4 <6.1.0`) and `eslint-plugin-react@7.37.5` throws inside a rule (`getFilename is not a function`) against ESLint 10. This is a deliberate deviation from brief §4's stack table, which asks for TypeScript 7 specifically so `next build` uses the native type checker. Re-checked on 2026-09-02: `typescript@7.0.2` and `eslint@10.9.1` have both shipped, but `typescript-eslint@8.69.0` — latest AND canary — still excludes TS 7 outright. The ESLint half has moved but not cleared: `typescript-eslint` now accepts `^10.0.0`, and the sole remaining cap is `eslint-plugin-react@7.37.5`, which is **transitive** via `eslint-config-next`, peers at `^9.7`, and whose `next` dist-tag (`7.8.0-rc.0`) is an _older_ release than latest. The ticket was moved from `todo` to `blocked` because 'todo' implied work someone here could do.

**What would fix it.** Nothing in this repo can lift it. Re-check when either package ships support; per the F-028 entry, `AGENTS.md` now says to look at `eslint-plugin-react` first next time, since that plugin is now the whole of the ESLint half.

**Why it matters.** Low as a product risk — `next build`'s type checking is identical either way, and TS7 was wanted for speed, not capability. Notable as the only genuine blocker in a 120+ ticket plan, and as an honest one: the evaluation was done twice and the answer was upstream both times.

_Cited from:_ `F-028`, `F-002`, `docs/BACKLOG.md:72`, `docs/BACKLOG.md:300-304 (Blocked table)`, `docs/PROGRESS.md:954-963`, `docs/PROGRESS.md:1094-1102`

### 2.2 The development host cannot produce a passing evaluation, so the product's core screens have never been seen with real data

Every submission on this machine resolves to an infrastructure `evaluation_failure` ("Isolate init error. Return value: 2") because Docker Desktop on macOS is cgroup v2-only and the vendored isolate 1.8.1 sandbox needs cgroup v1 — confirmed via `docker logs recodex-worker-1` showing `Checking for cgroup support for memory ... CAUTION`. This is a limitation the compose repo's own README already documents; it was re-discovered while verifying the seed script (F-025). The cost compounded across the whole build: S-015's test-result table, compilation-output panel and limit-exceeded badges have never rendered with data; S-013's class summary has only ever rendered "fully solved: 0" and "nothing has been scored yet"; D-011's evaluation-state logic is exercised only in unit tests because three of its six outcomes are infrastructure failure modes that cannot be produced on demand; and S-016's live-progress island cannot be photographed end to end because every evaluation here fails in under a second, so the pending window it exists for never opens (stopping the worker produces an immediate broker failure, "Worker ... dieded", not a queued job).

**What would fix it.** Re-run the full e2e suite and re-verify S-013, S-015, S-016 and D-011's badge states on a cgroup v1 Linux host before trusting evaluation-state UI. This is a one-afternoon task on the right machine and cannot be done on any macOS host.

**Why it matters.** The single largest verification hole in the project. Four screens and one pure-function state machine ship on unit tests and reasoning alone. Not a code defect and not this team's fault — but anyone reading "every phase done" should know the evaluation-results path has never been observed working.

_Cited from:_ `DEC-031`, `F-025`, `S-015`, `S-013`, `S-016`, `D-011`, `docs/PROGRESS.md:1217-1223`, `docs/PROGRESS.md:2741-2747`, `docs/PROGRESS.md:2859-2864`, `docs/PROGRESS.md:3708-3714`, `docs/DECISIONS.md:56`

### 2.3 T-009, the exercise configuration editor — the brief's own "hardest screen", and core-api publishes no schema for any of it

All five endpoints this screen reads and writes (`/v1/exercises/{id}/tests`, `/config`, `/environment-configs`, `/score-config`, `/config/variables`) are described in `openapi/core-api.yaml` as `"Placeholder response"` with **no response schema**, and their request bodies are `type: array, items: {}`. The vocabulary a configuration is built from — which variables exist (`expected-output`, `judge-type`, `success-exit-codes`, …), their types, which pipeline each belongs to, and the nine built-in judge programs — is published nowhere. core-api validates against it; the legacy frontend hard-codes it in `helpers/exercise/configSimple.js`. So the shapes were read off a live instance and re-stated in `lib/exercise-config/`, which is now a **second copy of an unpublished contract**. Compounding it, the screen's real difficulty was ordering: there are three saves and each invalidates the next — renaming a test changes the test's **id** (core-api copies a test rather than updating it and rewrites the configuration to point at the copy), and adding a language adds a whole branch — so the screen is three forms in dependency order, each refreshing after it saves, with the third not rendered at all until the first two are done.

**What would fix it.** Real response schemas on those five operations, or — better, and named as such in Q-020 — an endpoint that serves the descriptor table itself. Pipelines already publish their `parameters`, which is what makes deciding _where_ a variable goes possible without guessing; what is missing is the list of variables and their meanings. That is an API change, which this repo is forbidden to make (constraint 1).

**Why it matters.** High, and durable. An environment or variable added to core-api will not appear in this app until somebody notices. The same unpublished contract already cost the seed script (F-025) a cross-reference into legacy `configSimple.js`/`configAdvanced.js` and live calls to `POST /exercises/{id}/config/variables` to discover pipeline/variable IDs, because the OpenAPI spec was too generic to build from.

_Cited from:_ `Q-020`, `T-009`, `DEC-102`, `F-025`, `docs/QUESTIONS.md:264-290`, `docs/PROGRESS.md:390-432`, `docs/PROGRESS.md:1188-1195`

### 2.4 Three core-api defects were found only by building the control and watching it do nothing

Q-022: core-api publishes `isValid` on an instance licence as "administrator switch to toggle license validity", but `actionUpdateLicence` reads it as `$req->getPost("isValid") ? ... : $licence->isValid()` — so `false` is falsy, takes the else branch, and writes back what was already there, while `"false"` and `0` are rejected by the boolean validator first. Reproduced all three ways with `curl`. A licence can be set valid by any client and invalid by none. A revoke button was built on the strength of the published field and **deleted when the spec caught it doing nothing** — and that is also the explanation for the legacy app rendering a read-only column called "Without revocation". Q-021: deleting a user is a soft delete with anonymisation that appends one fixed `@deleted.recodex` suffix to the address, on a column whose unique index still covers soft-deleted rows — so an address can go through that once, and a second delete of a re-created address dies as `UniqueConstraintViolationException`, showing an administrator a raw Doctrine class name. Found by AD-001's own spec on its **second** run, then reproduced straight against core-api with `curl`. Q-023: `actionDeleteInstance` removes the instance row and stops, orphaning its root group — AD-004's spec had quietly left eight groups named `e2e instance …` in the superadmin's "My teaching" sidebar across four runs while the instance list showed one row.

**What would fix it.** Q-022: test `isset()` rather than truthiness in `actionUpdateLicence`. Q-021: include the deleted-at discriminator in the unique index, or make the anonymisation suffix unique per deletion. Q-023: either cascade the root group on instance delete, or document that it does not (the app's confirmation dialog now says what actually happens, because the obvious reading is wrong and being wrong about that in a destructive dialog is worse than the wart).

**Why it matters.** Each is individually low-impact (an unwanted licence can be deleted; deleting an address twice is rare; an orphan group can be deleted where groups are deleted) but they share a pattern that matters: a published field that lies, and a delete that does not cascade. All three were invisible to reading the API and to reading the spec; only a real write found them.

_Cited from:_ `Q-021`, `Q-022`, `Q-023`, `AD-001`, `AD-004 + AD-005 + AD-008`, `AD-006`, `docs/PROGRESS.md:840-855`, `docs/PROGRESS.md:738-748`, `docs/PROGRESS.md:898-907`, `docs/QUESTIONS.md:292-397`

### 2.5 T-015/T-016 damaged the live deployment, and the repair is the finding

The pipeline-editing spec forked a pipeline and typed into the next field before `router.push` had navigated, so two saves landed on the **seeded** pipelines instead of the copies; the cleanup afterwards then deleted two of them. Both were recovered only because core-api's delete is a soft one — setting `deleted_at = NULL` in the database brought them back with their original ids and their supplementary files intact, which recreating them could not have done (`runner.py` is attached to the pipeline, and a new pipeline has no way to adopt an existing upload). All fifteen pipelines were verified byte-identical to a snapshot taken before the session. The spec now has an `openCopy` helper that will not touch a field until the address has actually changed to a different pipeline, and an `afterEach` that removes every copy even when a test dies first — the suite's first write helper against core-api.

**What would fix it.** Two things generalise. (1) Any Playwright helper that navigates before typing must assert the address changed first — this is now the `openCopy` pattern. (2) There is no supported way to re-attach an existing supplementary file to a new pipeline; that gap is separately filed as G-015 (no screen lists, uploads, replaces, removes or downloads pipeline files, and the seeded pipelines reference one).

**Why it matters.** The most serious self-inflicted incident in the log. It was recoverable by direct database surgery, not by any capability the app or the API offers. A ReCodEx instance with hard deletes, or a spec run by someone without database access, would have lost two pipelines and an uploaded runner script permanently.

_Cited from:_ `T-015 + T-016`, `G-015`, `docs/PROGRESS.md:590-600`, `docs/BACKLOG.md:217`

### 2.6 Three attempts to fix one Docker crash, and both popular internet answers were wrong

F-003's `docker build` succeeded first try; `docker run` immediately crashed with `Cannot find module '.../@swc/helpers/esm/_interop_require_default.js'`. Attempt 1 added `@swc/helpers` as an explicit direct dependency (the most commonly cited fix online) — same crash. Attempt 2 set `outputFileTracingRoot` (the fix for the documented "monorepo symlink" variant) — same crash. Attempt 3 diagnosed it properly by diffing `node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers/` between the full pnpm store and what ended up in `.next/standalone`: **the Next.js file tracer copied `cjs/` and silently dropped `esm/`**, which is what `require-hook.js` actually needs. Fixed with `outputFileTracingIncludes: { "/**": ["...@swc/helpers/**"] }`, then verified with a real `docker build` → `docker run` → `curl` returning HTTP 200 with rendered content, not "the build didn't error".

**What would fix it.** Already fixed and recorded. Worth carrying forward as a diagnostic habit rather than a config: if a package crashes the standalone server this way, check for a missing subdirectory in its traced copy first.

**Why it matters.** Cost real time on ticket three of the project, and the lesson generalises to every future dependency: the tracer can silently omit a subdirectory, and the two standard answers do not address that. The log explicitly says to diff traced output against the pnpm store before reaching for either again.

_Cited from:_ `F-003`, `docs/PROGRESS.md:1122-1140`

### 2.7 Two production-only failures that `next dev` and CI were both green on

DEC-039: `app/api/auth/logout/route.ts` built its redirect with `new URL("/login", request.url)` — the pattern used everywhere else in the codebase. Fine in `next dev`; in the actual `output: standalone` container the `Location` header pointed at `http://0.0.0.0:3000/login`, the container's own internal bind address, instead of where the browser actually was. Confirmed with a temporary uncommitted debug endpoint echoing both `request.url` and `request.headers.get("host")`: the `Host` header was correct (`localhost:3001`), `request.url` was not. A relative `Location` was tried as a simpler fix and also failed — `NextResponse.redirect()` throws `URL is malformed "/login"` despite its parameter being typed as accepting a plain string. D-003: `useSearchParams()` in `DataTable` passed `next dev` and even a local ad-hoc `next build` cleanly, and failed only when the Docker image was rebuilt with the debug route present — "useSearchParams() should be wrapped in a suspense boundary" — because `next dev` has no static-generation step to enforce it against.

**What would fix it.** The convention that came out of it is right and should be stated in onboarding: build absolute URLs from the `Host` header via `buildAbsoluteUrl()`/`requestOrigin()`, never from `request.url`, in any Route Handler or Server Component; and treat the Docker standalone build, not `next dev`, as the pass/fail gate.

**Why it matters.** Both were caught, but only because this project adopted the Docker standalone build as the authoritative check. A team that trusts `next dev` plus CI would have shipped both. DEC-039's shape recurred as a live trap at least twice more: DEC-091 (T-018's invitation link needs an origin, and `request.url` is one of three wrong ways to get it) and the reason F-023's Playwright harness runs against `next build`/`next start` rather than `next dev`.

_Cited from:_ `DEC-039`, `F-017`, `D-003`, `DEC-091`, `T-018`, `F-023`, `docs/DECISIONS.md:64`, `docs/PROGRESS.md:1826-1836`, `docs/PROGRESS.md:1670-1674`

### 2.8 The plan for pipeline visualisation was implemented, then thrown away because the library crashes on a size threshold

Brief §7 named pipeline visualisation as a landmine to decide early. Server-side Graphviz was the plan and **was implemented**; then `@viz-js/viz@3.30.0` (Graphviz 16.0.0) crashed on the seeded Python pipeline with `RuntimeError: table index is out of bounds`. Reduced to plain synthetic input: **ten record nodes with an empty leading cell crash it, five do not** — the exact label shape the legacy renderer emits, and a size threshold rather than a syntax error, so every realistic pipeline is a coin toss. The layout is now this app's own pure function and the drawing is string building, both server-side, both unit-tested. Two things came free: the colours are design tokens so the diagram is themed, and every node carries `data-name` so selection will not need the legacy click handler's trick of parsing generated markup for `<title>` elements. Getting the layout right took work of its own: the naive "every source in layer 0" rule draws a mile-wide row for a ReCodEx pipeline (nearly all sources); working back from the sinks took the seeded graph from 2075px to 1507px wide, and adding the port's own position to the barycentre key took long crossing edges from 8 to 5.

**What would fix it.** Already done and recorded as DEC-107, which also closes DEF-003 and removes viz.js from the dependency set while keeping the capability.

**Why it matters.** High-effort, and the right call. A WASM Graphviz that fails non-deterministically on realistic input is worse than no visualisation. The replacement also paid out immediately: T-016's structure editor redraws the graph live using the same pure functions, which would have been impossible with an async WASM renderer.

_Cited from:_ `T-013 + T-014`, `DEC-107`, `DEF-003`, `T-016`, `docs/PROGRESS.md:544-563`, `docs/PROGRESS.md:576-580`

### 2.9 Playwright lied twice, and one of the failures was core-api's capacity rather than a bug

Building F-023 hit three distinct problems. (1) A debug route under `app/api/_debug-f022/` silently 404'd — Next excludes `_`-prefixed segments from routing entirely. (2) `test.use({storageState: path})` declared at `describe` scope turned out to silently become the default for **any** context Playwright creates in that scope — reproduced with both `browser.newContext()` and `playwright.request.newContext()` called from inside the very `beforeAll` meant to create the file, both throwing ENOENT reading it. Not documented behaviour that could be found in the bundled types; found by testing. Fixed by dropping `storageState` entirely and injecting cookies via `context.addCookies()`. (3) Even after that, 3 of 48 tests failed intermittently with the _server's own_ `ConnectTimeoutError` to `recodex.local:80` — the default 7-worker CPU-core count sent enough concurrent bcrypt-hashing logins to the local PHP-FPM pool to exceed core-api's request-handling capacity within the fetch timeout. Confirmed via the Next.js server log, and confirmed core-api logged **no** non-200 in the same window: the requests were queuing, not failing, until the client gave up. Not a code bug; fixed with `workers: 2`. Separately, `locator.evaluateAll()` does not auto-wait and `page.goto()` resolves while `loading.tsx` is still on screen — a helper that collected links that way read zero of them from a full page, passing against `next dev` and failing against the production build, which streams differently (S-017). The same non-auto-waiting trap re-flaked the dashboard spec (T-003) once S-025 added a fan-out.

**What would fix it.** Recorded in DEC-045. The durable rules: never use `evaluateAll` on a streamed page without waiting for a real element first; cap Playwright workers against a local core-api; and note that the whole suite is deliberately **not** in CI (GitHub Actions has no reachable core-api and no way to stand one up from this repo alone).

**Why it matters.** Moderate individually, high as a pattern: the harness is brief §8's "main safety net", and three of its earliest failures were the harness misleading rather than the app misbehaving. The worker-count finding is the interesting one for the ReCodEx team — a local core-api stack saturates at roughly 7 concurrent bcrypt logins.

_Cited from:_ `F-023`, `DEC-045`, `S-017`, `T-003`, `docs/PROGRESS.md:1675-1700`, `docs/PROGRESS.md:2782-2787`, `docs/PROGRESS.md:3399-3403`, `docs/DECISIONS.md:70`

### 2.10 The seed script could not run on a fresh database — four bugs, on top of three found earlier — and it is the thing that makes the instance usable

F-025 was verified idempotent when written (four consecutive runs, last one all `exists, reused`). The Phase-2 review pass found it **could not run on a fresh database at all**, four separate ways. (1) It hardcoded a python3 pipeline UUID commented "verified live against this deployment" — the verification was genuine and the value is still wrong everywhere else, because **core-api assigns pipeline ids when the runtime package is imported**, so every fresh database gets different ones. (2) It treated "an exercise with this name exists" as "that exercise is usable"; a run that dies partway leaves an exercise that matches by name and that core-api rejects as _broken_ on the next assignment attempt. (3) `POST /exercises/{id}/tests` **adds** rather than replaces, so re-running failed with "test name 'Test 1' is already taken". (4) Exercise edits are guarded by optimistic concurrency and the payload hardcoded `version: 1`, which only works on an exercise nobody has touched. `SEED_ACCOUNTS.md` had claimed "verified idempotent" — it was, on the path where nothing had gone wrong before. F-025's own build had already turned up three more: an unauthenticated registration call (403 because `LOCAL_REGISTRATION_ENABLED=false` requires a privileged caller), adding a supervisor to an already-archived group (403 because `becomeMember`'s ACL evaluates `group.isNotArchived` against the _target user's_ role), and `localizedStudentHints` causing a PHP 500 TypeError when sent as an array rather than a locale-keyed object. And T-020 found a seventh, the hard way: `GET /exercises` **excludes archived exercises**, so lookup-by-name could not see the archived fixture and created a second copy of it on every run.

**What would fix it.** All seven fixed; ids now looked up by name and runtime environment, configuration steps re-run for reused exercises, tests sent with their existing id as an update, versions read back first, `filters[archived]=all` on lookup. The generalisable lesson recorded in the log: a script verified idempotent on the happy path is not verified idempotent.

**Why it matters.** High. DEC-052's whole point was a one-command bootstrap on another machine, and before this pass the entire e2e suite — including the non-negotiable token-leakage security spec — could not run on a fresh instance at all. It went from failing to 64 passing tests on that fix alone.

_Cited from:_ `F-025`, `F-026`, `Review pass 2026-08-21`, `T-020`, `DEC-052`, `DEC-029`, `DEC-030`, `docs/PROGRESS.md:1195-1216`, `docs/PROGRESS.md:2355-2372`, `docs/PROGRESS.md:161-165`

### 2.11 Adding a Dependabot config file took an action the moment it landed, on somebody else's repository

F-027 added `.github/dependabot.yml` during the Phase-2 review pass to close a missed brief requirement. It reached GitHub and Dependabot ran **immediately against the default branch** rather than waiting for its schedule, opening three PRs (`actions/checkout` v4→v7, `actions/setup-node` v4→v7, one grouped npm update) against `main` while the operator's own work sat in a PR from `dev`. The grouping in that config is the only reason it was three PRs and not about ten. The log's own assessment: "My error was not the config, it was not flagging it. Adding that file is not a free documentation-style change: it takes an action the moment it lands. I treated a missed brief requirement as costless and enabled a robot on someone else's repository without saying so." Reverted; replaced with `pnpm deps:check` (`pnpm outdated` + `pnpm audit`) as a process step, plus GitHub's passive Dependabot _alerts_, which need no config file and open no PRs. The trade-off is stated in DEC-056: weaker latency, stronger control. The first run of `deps:check` immediately found `next` at 16.3.1 against 16.3.2 released, and that TS 7 and ESLint 10 had both shipped — which is how F-028 came to be filed.

**What would fix it.** Already reverted and replaced. The rule that generalises: treat any file that activates a bot, a webhook or a scheduled job as an action requiring approval, not as documentation.

**Why it matters.** The clearest process failure in the log, and the one most worth repeating to the team. It is a category error, not a coding error: config files that activate automation are side-effectful writes and should be shown as a diff first, the way F-004's compose entry was.

_Cited from:_ `F-027`, `DEC-056`, `F-028`, `F-004`, `DEC-028`, `docs/PROGRESS.md:2394-2412`

### 2.12 P-001 found that 65 of 138 parity-contract rows were wrong, in both directions

The parity sweep read all 138 `INVENTORY.md` rows against the code rather than against the plan. **65 status cells were wrong**: 40-odd still said `todo` for screens shipped months earlier (`app/archive`, the solution screen, `evaluationProgress`, `i18n`, `Breadcrumbs`, `Nested subgroups`, `Judge log display`), and a dozen said `done` for rows whose write half was never built. The file had been consulted as the parity contract while saying almost nothing true about it since May. The sweep's real finding is a shape: **this app reads well and writes badly**. Twenty-nine gaps came out, and **fourteen are one button against an endpoint `lib/api/core-api.generated.ts` already types and no code calls** — `set-flag/{flag}`, `/bonus-points`, `/resubmit`, `/download-best-solutions`, shadow-assignments POST/DELETE, `POST /v1/groups`. The pattern: a ticket that said "the X screen" got read as "render X", and the actions on that screen went with the screen rather than being tickets of their own. The sharpest instance: **S-002 built the teacher's queue of requested reviews, `reviewRequested` is read in four places, and nothing in this app can set it.** Three gaps are things a person simply cannot do: a group cannot be created at all (G-008, so a course cannot be started here), a shadow assignment cannot be created or edited (G-009 — which is why `scripts/seed.ts` makes them by raw API call), and a teacher cannot override the points a solution scored (G-001, which the landing page A-001 shipped happens to advertise). Two brief §7 landmines were checked and **one had been stepped on**: solution diffing (G-005) is named in three inventory rows with "Keep capability" in its Action Required column, and nothing was built — no route, no component, no dependency. And the last `PlaceholderPage` in the product, `/faq` (G-024), is linked from the landing page's second call-to-action.

**What would fix it.** The G block, in the order BACKLOG.md lists it, starting G-008. Structurally, the lesson for the next plan: file the write actions on a screen as their own tickets rather than assuming they ride along with the render, and re-derive the parity contract from code on a schedule rather than updating it by hand as tickets close.

**Why it matters.** Highest-value finding in the project, and unflattering. Every phase was marked done and parity was not met. The self-report shape — six readers each taking a slice, then each slice's claimed gaps going to a second reader instructed to refute with "default to refuted when in doubt", killing four claims — is the reason the remaining 29 should be believed.

_Cited from:_ `P-001`, `G-001`, `G-005`, `G-008`, `G-009`, `G-024`, `S-002`, `docs/PROGRESS.md:3484-3521`, `docs/BACKLOG.md:206-234`, `docs/PROGRESS.md:3606-3611`

### 2.13 Six bugs in the app's own already-shipped work, each found only by a later ticket needing the thing

(1) T-001's exercise picker sent `?search=` — core-api takes filters in a **`filters` array** (`filters[search]`) and silently ignores unknown top-level parameters, so the search box did nothing and the "matched" count was the whole catalog. Found by T-020 reading the endpoint's own whitelist; confirmed live both ways (`filters[search]=zzz` → `totalCount: 0`; `search=zzz` → everything). The same silent-whitelist behaviour applies to `orderBy`: `orderBy=bogus` answers HTTP 200 with rows in arbitrary order, not an error (AD-001). (2) D-014's "My Teaching" sidebar section had **never rendered on this instance** — `/v1/users/{id}/groups`' `supervisor` key is `getGroupsAsSupervisor()`, one membership type, and a user who _administers_ a group appears in neither list. Not for `sasha.mentor` (the brief's own "one person, two audiences" persona), not for the superadmin who admins all four seeded groups. An absent optional section looks exactly like a correct one, which is why nothing caught it; found by S-001 only because the author's own teacher slot was untestable. (3) The sidebar linked to routes that did not exist — and Next prefetches every visible `<Link>`, so 404s were logged on the _linking_ page; invisible until seed data existed, then caught by the smoke suite's console-error check. (4) Every `(anon)` page was missing its `<main>` landmark (found by S-024's spec), and the root page still was at A-001, months later. (5) D-009 gave each code line `id="L{n}"` — right for one file per page, silently wrong for eight; every line on a multi-file page claimed `#L1` (found by S-017). (6) T-002 found that a student could open an assignment's settings form: `apiRead`'s 403 does not fire because _reading_ an assignment is legitimate for a student, and only the save would have been refused.

**What would fix it.** Two habits generalise. First, core-api's parameter whitelists fail **silently** on both `filters` and `orderBy`, so any list screen must be verified by asserting a row _disappears_, not by asserting the page renders — T-001's spec was rewritten to do exactly that. Second, an absent optional section is indistinguishable from a correct one; sections gated on data need a persona that can reach them or a filed ticket saying nobody can (which is what F-029 is).

**Why it matters.** Moderate individually; collectively the strongest argument in the log for the project's verify-live discipline. Every one of these passed typecheck, lint, build and CI. Three of them (the search box, My Teaching, the anchors) were features that appeared to work and did nothing.

_Cited from:_ `T-020`, `T-001`, `S-001`, `D-014`, `AD-001`, `S-024`, `A-001`, `S-017`, `D-009`, `T-002`, `DEC-058`, `F-029`, `Review pass 2026-08-21`, `docs/PROGRESS.md:143-152`, `docs/PROGRESS.md:2437-2447`, `docs/PROGRESS.md:2377-2385`, `docs/PROGRESS.md:3199-3202`, `docs/PROGRESS.md:2765-2769`, `docs/PROGRESS.md:3400-3405`

### 2.14 core-api's permission hints exist for exactly one entity, so four screens had to restate ACL rules by hand

DEC-080 found `permissionHints` is `null` on `/v1/users/{id}` even for a superadmin reading a student, because core-api gates _fields_ rather than the entity (`privateData` is built only under `canViewPrivateData`; `/v1/users/{id}/groups` 403s under `canViewGroups`). DEC-110 established the general case: `permissionHints` is emitted for **exactly one entity in the entire API** (`GroupFormat`). The consequence recurs. AD-001 offers its actions on the reader's role instead of a hint. S-026 is "the one screen in this app that reads an ACL's conditions instead of a permission hint, because there is no hint to read" — `addStudent` and `removeStudent` are **absent from a group's `permissionHints` entirely** (confirmed live: keys missing, not `false`) because both rules are written against a _student_ subject (`student.isSameUser`, `student.isNotGroupLocked`) and a hint computed for the group alone has nobody to put in that slot. T-005 hit the same shape a third time with `canViewStudentStats`. What keeps this honest is that every Server Action calls core-api on the **caller's own token**, so the button and the forged call meet the identical check — the role decides what is _offered_, core-api still decides what _happens_. Verified as such: 200 for the student herself, 403 for a classmate.

**What would fix it.** Emit `permissionHints` on user and solution entities the way `GroupFormat` does; for subject-dependent rules like `addStudent`, either compute the hint against the requesting user or publish the conditions. Until then the app's restated rules are load-bearing and undocumented outside DEC-080/DEC-090/DEC-110.

**Why it matters.** Structural, and worth the ReCodEx team's attention. Every screen that restates an ACL condition is a copy free to drift from `permissions.neon`. The mitigation (act on the caller's token) is correct and means no security hole, but the _offered_ affordances can and will diverge from what is permitted.

_Cited from:_ `DEC-080`, `DEC-090`, `DEC-110`, `S-021`, `AD-001`, `S-026`, `T-005`, `docs/PROGRESS.md:3121-3128`, `docs/PROGRESS.md:3316-3324`, `docs/PROGRESS.md:700-710`, `docs/PROGRESS.md:65-70`

### 2.15 D-010: ten of sixteen markdown constructs rendered differently, and two would have silently damaged authored content

Brief §7 said to render real exercise texts both ways early. Sixteen constructs were run through the legacy renderer (`markdown-it` at its defaults + `@iktakahiro/markdown-it-katex`) and the candidate pipeline side by side in a scratch harness outside the repo. **Ten of sixteen differed.** Two were destructive. (1) **Raw HTML disappeared entirely** — legacy runs `html: false`, which escapes and _shows_ raw HTML; react-markdown without `rehype-raw` _drops_ it, so `<div class="note">Read <b>carefully</b>.</div>` rendered as nothing and `<kbd>Enter</kbd>` rendered as the bare word "Enter". Fixed by converting those nodes to text, deliberately **not** by adding `rehype-raw`, which would start _executing_ markup the legacy app has always shown as inert — a new injection surface in supervisor-authored content seen by every student. (2) `It costs $5 and $10` **became mathematics**: `remark-math` recognises `$...$` far more eagerly than markdown-it-katex. The legacy rules were measured, not guessed (no whitespace immediately inside the delimiters; `$$` is display math only when it stands alone), by inspecting each node's original source span. The repo's first unit tests caught three more plugin bugs before anything rendered — including that the two visitors match the same nodes, so the second silently reverted the first's work until it learned to skip already-labelled display math. And one failure only the running app could show: react-markdown executes its plugin pipeline **synchronously**, so the ordinary async `@shikijs/rehype` plugin dies at request time with `runSync finished async. Use run instead` — typecheck, lint and build were all green, because the route renders per request and the build never exercised it. The log calls it the "fourth bug this phase that only running the thing caught."

**What would fix it.** Done and recorded as DEC-055; the six additive differences (GFM autolinks, task lists, footnotes, `<del>` vs `<s>`, entity re-encoding) are accepted rather than fixed, and written down so they are not rediscovered.

**Why it matters.** High-value early work that prevented a parity disaster. Had this been left to the parity sweep as brief §7 warned, raw HTML in every exercise text authored over the life of the legacy app would have silently vanished from the new frontend.

_Cited from:_ `D-010`, `DEC-055`, `docs/PROGRESS.md:2172-2216`

### 2.16 Fixtures that did not exist had to be manufactured, sometimes by writing to the API directly

A recurring cost: the screen was buildable but the _state_ it renders was unreachable. S-002's two dashboard queues needed a review request (a flag only a _student_ sets, `set-flag/reviewRequest`) and an open review (`POST .../review` with `close: false`, setting `reviewStartedAt` and leaving `reviewedAt` null) — states no amount of submitting produces. S-019's detected-similarities report has **no way to be reached with data except for a detection tool to have uploaded some**, so the seed performs exactly that upload (a second student, a near-identical solution, a batch, one similarity, `uploadCompleted`) — and it is idempotent on the batch existing because **nothing can delete any of it**. S-008's exam fixture is the real sequence compressed, because core-api creates the `GroupExam` record in `actionLockStudent` — at the **first student lock**, not when the period is set. S-023 seeded five invitation links (open, expired, already-joined, organizational, archived) because no group had a single invitation and every branch was unreachable. S-026 had to make a group public and found a trap doing it: `actionUpdateGroup` replaces the whole group with what it is sent, and omitting `externalId` is a **500**, not a 400. S-017 had to grow a ZIP fixture, built with a small stored-entry ZIP writer rather than shelling out to `zip(1)`. And S-024's invitation token had to be **minted locally with the instance's own signing key**, because this deployment has no working SMTP and no `mail.debugMode` archive to read one from (Q-007).

**What would fix it.** Two API-side asks would remove most of it: a way to delete a plagiarism batch, and a token-validation endpoint (Q-018) so an invitation can be checked without submitting it. Everything else is documented in `SEED_ACCOUNTS.md` and is a cost the next team inherits rather than a defect.

**Why it matters.** Moderate but pervasive — this is a real tax on any frontend rewrite against ReCodEx, and it is invisible in a ticket estimate. Several of these fixtures are permanent pollution: the plagiarism batch cannot be deleted, and the e2e suite reads it rather than creating its own each run.

_Cited from:_ `S-002`, `S-019`, `S-008`, `S-023`, `S-026`, `S-017`, `S-024`, `Q-007`, `Q-018`, `DEC-073`, `DEC-078`, `docs/PROGRESS.md:2482-2490`, `docs/PROGRESS.md:3065-3072`, `docs/PROGRESS.md:2977-2984`, `docs/PROGRESS.md:3327-3331`, `docs/PROGRESS.md:3229-3234`

### 2.17 A refused page still answers HTTP 200, and the fix is bigger than any ticket that found it

Q-016: `forbidden()` renders the right page — the reader is told in words that they may not see this — but the response status is **200**. Measured with a probe route whose entire body was `forbidden()`, so this is not about how late in the page the call sits: the `(app)` shell streams its first bytes before any page body runs, and the status line is written with them. DEC-034 had chosen `experimental.authInterrupts` specifically because it was "the only way to get a real 403/401 status code from the App Router"; for a route inside the authenticated shell that turns out to be half true. Both plausible fixes are bigger than the ticket that found it: deciding the permission in `proxy.ts` would give a real status but require asking core-api about the entity on every request — a round trip per navigation to answer a question the page then asks again; rendering the whole `(app)` shell non-streaming would trade every page's first paint for a status code that only matters to non-browser clients. F-030 fixed the half a reader can see (a core-api 403 now renders as a refusal rather than the generic "something went wrong" error boundary) and left the status line unchanged, which Q-016 explicitly records.

**What would fix it.** Neither available fix is cheap. Worth deciding deliberately rather than inheriting: either accept it and document it, or take the non-streaming shell cost on the `(app)` group only. Raising it with the Next.js team as an `authInterrupts` limitation is the third option.

**Why it matters.** Low for browser users, real for anything else — monitoring, crawlers, API-style clients and any future integration will see 200 on a refusal. It affects every permission-gated screen from S-013 onward, which by now is most of the teacher and admin surface.

_Cited from:_ `Q-016`, `DEC-034`, `F-030`, `DEC-070`, `S-013`, `docs/QUESTIONS.md:155-181`, `docs/PROGRESS.md:3693-3696`

### 2.18 The backlog described screens nobody had opened — three times — and the recon docs were wrong about the deployment on day one

Three backlog rows named capabilities that do not exist. AD-006: "Runtime environments, hardware groups" — the legacy `ServerManagement` page contains neither; it is the ZeroMQ broker and core-api's background job queue. And **neither runtime environments nor hardware groups have an administration screen anywhere in the legacy app** (grepped, not assumed) — they are read-only vocabularies surfacing in T-009 and T-010, both already built. AD-004/005/008: "Instance edit — settings, limits" — `POST /v1/instances/{id}`'s entire request body is `{isOpen}`; there are no limits and one setting, which is why the legacy `EditInstance` page is a single checkbox (an instance is mostly its root group wearing a hat). AD-002: half of it — "User detail: info, groups, solutions" — had shipped months earlier as S-021. The same pattern in reverse produced T-020 and T-021, two tickets that had to be _filed_ mid-session because the teacher block jumped from assigning an exercise to editing one while the sidebar had been linking to a `PlaceholderPage` since D-014. And the very first correction session found all four verified assumptions in QUESTIONS.md/DECISIONS.md **wrong**: the API base URL (assumed `localhost:4000/v1`, actually `http://recodex.local/api/v1` public / `http://api:80/v1` internal), CAS assumed enabled (no `EXTERNAL_AUTH_*` configured at all, and `LOCAL_REGISTRATION_ENABLED=false`), the monitor WebSocket assumed `wss://` (plain `ws://`), and the OpenAPI spec assumed served at `/v1/api-docs` (404 — nginx exposes only `www/`, so the spec is read from disk at codegen time). Plus F-001 had scaffolded the whole app **inside the compose repo**, a direct violation of the brief's "new, empty repository".

**What would fix it.** The recon lesson the log states itself: it was thorough about the legacy _application_ and had not looked at the _deployment_. Read `ReCOdex/.env` and `docker-compose.yaml` directly at the start of any session touching env or URLs, and grep the legacy source for a screen before writing a ticket that promises to port it.

**Why it matters.** Moderate, but it is the same root cause as P-001's 65 wrong status cells: planning artefacts written from the legacy app's route table rather than from its behaviour, then trusted for months. Four of the five cases cost a ticket's worth of investigation to discover there was nothing to port.

_Cited from:_ `AD-006`, `DEC-114`, `AD-004 + AD-005 + AD-008`, `DEC-113`, `AD-002`, `T-020`, `T-021`, `CORRECTION-001`, `CORRECTION-002`, `docs/PROGRESS.md:878-885`, `docs/PROGRESS.md:840-847`, `docs/PROGRESS.md:756-761`, `docs/PROGRESS.md:1037-1067`, `docs/PROGRESS.md:133-140`

### 2.19 Several capabilities could only be verified by hand, because the app itself cannot create the state

A category the test suite structurally cannot cover, each documented rather than skipped. T-002's re-sync button: making an assignment drift means editing the exercise it came from, and no screen did that until T-008 — so the exercise's text was changed by hand, the notice confirmed to name `localizedTexts` as stale, the button used, and both entities put back exactly as seeded. A-007's external sign-in link: the deployment configures no authenticator (Q-004), so the three variables were set in `.env.local`, the app rebuilt, the button confirmed to render with exactly the configured URL, then removed and rebuilt again — the _spec_ asserts the absent case, which is the state this deployment can actually be in. S-022 deliberately never changes a password in the suite: it would invalidate the seeded account for every other spec with no way to put it back (core-api sets a token-validity threshold that kills the requesting token), so the spec asserts only the form's own rule. S-023 deliberately never accepts an invitation, because **leaving a group was a legacy capability this app had not built** — which is how S-026 came to be filed. AD-006's e2e spec deliberately never confirms the broker freeze: a test that died between freezing and unfreezing would leave the whole deployment swallowing submissions for every spec after it; it asserts the dialog and cancels.

**What would fix it.** Nothing to fix — but a reviewer reading test counts (257 e2e, 170 unit at the end) should know that the password change, the broker freeze, the external-auth link, the invitation accept and the exercise re-sync are all outside those numbers by design.

**Why it matters.** Low risk, high honesty. Each of these is a place where the log says plainly what was not automated and why, which is more useful than a green suite that quietly skips them. The AD-006 freeze reasoning in particular is exactly right.

_Cited from:_ `T-002`, `A-007`, `S-022`, `S-023`, `S-026`, `AD-006`, `Q-004`, `docs/PROGRESS.md:3419-3424`, `docs/PROGRESS.md:980-986`, `docs/PROGRESS.md:3162-3165`, `docs/PROGRESS.md:3195-3199`, `docs/PROGRESS.md:889-893`

---

## 3. Weak spots in what was built

The unflattering summary of this codebase, drawn from its own notes, is that it is a very well-built reader and a half-built writer, verified against a deployment that cannot run the product's central function. P-001 (PROGRESS.md:3484) names the first half explicitly: 29 parity gaps, 14 of which are one button over an endpoint `lib/api/core-api.generated.ts` already types and no code calls, and the pattern is a scoping failure, not an accident — "a ticket that says 'the X screen' got read as 'render X', and the actions on that screen went with the screen they were on rather than being tickets of their own." The second half is the environment: cgroup v2 (DEC-031), no SMTP (Q-007) and six runtime environments (Q-020) mean the solution screen's evaluation table, the live-progress island, the teacher's class summary, the source viewer's two failure notices and three parts of the configuration editor have never once been rendered with real data. Two further weaknesses sit underneath both: every response type in the repo is hand-written because core-api publishes no response schemas anywhere (DEC-044), and the 257-test e2e suite that is the only thing testing this app against a real API is deliberately not in CI (DEC-045). Where the docs are unflattering they are unusually honest — most of what follows is quoted from admissions the authors filed against themselves.

### 3.1 The write half was never scoped as work: 14 of 29 parity gaps are a control over an endpoint the repo already types and never calls

P-001's central finding is a shape, not a list: "this app reads well and writes badly." Fourteen of the twenty-nine gaps are one button against an endpoint `lib/api/core-api.generated.ts` already types and nothing calls — `assignment-solutions/{id}/set-flag/{flag}`, `/bonus-points`, `/resubmit`, `/download-best-solutions`, `shadow-assignments` POST/DELETE, `POST /v1/groups`. The sharpest instance is `reviewRequested`: S-002 built the teacher's dashboard queue of solutions students have asked to have reviewed, the field is read in four places (`lib/api/assignment.ts:175`, `lib/api/assignment-solvers.ts:89`, `lib/api/dashboard.ts:384`), and nothing in this app can set it — the queue can never fill. Same shape elsewhere: `lib/actions/pipeline.ts:130` `createPipeline()` exists and has no caller (G-016); `app/api/auth/restricted-token/route.ts` shipped as F-021, is verified live under DEC-043, and has no caller anywhere in the repo (G-020); the accepted-solution badge "is already rendered everywhere" and nothing can set it (G-001). P-001 diagnoses the cause without softening it: a ticket named for a screen was read as "render that screen", and the actions on it went along with the screen rather than being tickets of their own.

**What would fix it.** Two things. (1) Change the definition of done for a screen ticket: before closing, enumerate every core-api operation on that screen's entity, and file each unbuilt control as its own ticket — P-001's own method (`grep` the generated paths for typed-but-uncalled operations) is cheap and repeatable and should be a CI-adjacent script, not a one-off audit. (2) Run that grep now as a standing check: typed-and-never-called is a mechanically detectable condition, and it caught 14 of 29 gaps here.

**Why it matters.** The most important item in this section. It is not 29 missing buttons — it is a defect in how every screen ticket was written, so the same gap will reappear in the G-block and in any future phase unless the ticket template changes. It also means "phase complete" in PROGRESS.md's history has meant "the reads are complete" for six months.

_Cited from:_ `P-001`, `docs/PROGRESS.md:3484-3500`, `G-001`, `G-003`, `G-016`, `G-020`, `docs/BACKLOG.md:207-232`, `lib/api/assignment.ts:175`, `lib/api/assignment-solvers.ts:89`, `lib/api/dashboard.ts:384`, `lib/actions/pipeline.ts:130`, `app/api/auth/restricted-token/route.ts`, `DEC-043`

### 3.2 Three things a person simply cannot do, and one of them means a course cannot be started at all

G-008: a group cannot be created. The hierarchy can be read, renamed, moved, archived and deleted and never extended — `grep -rn createGroup lib components app` finds only `createGroupInvitation`. `POST /v1/groups` is typed and uncalled. G-009: a shadow assignment cannot be created or edited, which is why `scripts/seed.ts` has to create them by raw API call — the seed script is doing what no screen can. G-001: a teacher cannot override the points a solution scored or accept it as final, which is the mechanism for grading what the pipeline got wrong; the public landing page A-001 shipped happens to advertise it. G-005 is the fourth and it is a whole screen rather than a control: solution diffing is one of brief §7's two named landmines, appears in three INVENTORY.md rows whose "Action Required" column says "Keep capability", and nothing was built — no route, no component, no dependency. DROPPED.md files `react-diff-viewer` under "replaced by **Nothing**" and refuses to tidy the row away.

**What would fix it.** G-008 first (BACKLOG.md already names it as next, with DEC-093's create-then-configure shape). G-005 needs a real estimate rather than a ticket line — it reuses S-017's file loading and `lib/code/highlight.ts` tokens the way `reviewable-code.tsx` does, but it is a screen with its own pairing, side-swap and file-name-mapping state.

**Why it matters.** G-008 alone makes the app unusable as a replacement: an instance administrator cannot start a course in it. G-005 is the largest single piece of unbuilt UI in the product and the only brief-flagged landmine that was stepped on.

_Cited from:_ `G-008`, `G-009`, `G-001`, `G-005`, `docs/BACKLOG.md:206-212`, `P-001`, `docs/PROGRESS.md:3502-3512`, `DROPPED.md DROP-012`, `scripts/seed.ts`, `A-001`

### 3.3 Entire screens have never been rendered with real data, and the docs say so in three separate places

This is the confidence problem, not an environment footnote. cgroup v2 on the dev host (DEC-031) means no submission on this instance ever produces a genuine pass or fail — every one resolves to `Isolate init error`. Consequences, each recorded by the ticket that hit it: S-015's test table, compilation output and limit badges "have **never been rendered with real data**"; S-016's pending-evaluation progress island cannot be exercised because every evaluation here fails in under a second, and stopping the worker produces an immediate broker failure rather than a queued job; S-013's class summary has only ever rendered "fully solved" as zero and its average-points tile as "nothing has been scored yet"; the student dashboard reports every seeded submission as "Not submitted" (Q-012). Separately, S-017's `tooLarge` and `malformedCharacters` notices have never rendered because no seeded solution is over core-api's preview limit or non-UTF-8. Separately again, Q-020: this deployment installs six ordinary runtime environments, so the `data-linux` and `haskell` descriptor variants and the rule that five environments (`arduino-gcc`, `data-linux`, `prolog`, `haskell`, `pyspark`) cannot share an exercise are ported from the legacy table and have never been rendered at all.

**What would fix it.** Stand the stack up once on a cgroup v1 host and re-walk exactly the list PROGRESS.md's Current Status already enumerates — it is a checklist, not an investigation. Add seed fixtures for the two S-017 cases (F-029's pattern: the ZIP case was closed that way and found a real anchor bug). Q-020's three items need an instance that installs those environments; if none exists, they should be marked as ported-and-unverifiable rather than done.

**Why it matters.** High and structural. The evaluation result is the reason ReCodEx exists, and the screen that displays it is the least-verified screen in the product. Everything else in this app was verified live, which makes the untested surface unusually easy to mistake for tested.

_Cited from:_ `DEC-031`, `Q-012`, `Q-020`, `S-015`, `S-016`, `S-013`, `S-017`, `F-029`, `docs/PROGRESS.md:3709-3727`, `docs/PROGRESS.md:2860-2864`, `docs/PROGRESS.md:2793-2795`

### 3.4 Every account-recovery and invitation flow was verified by forging tokens with the instance's private key, because no mail has ever been sent

This deployment's SMTP host is `smtp.example.com` (Q-007). So the three flows whose entire user journey begins with an email were each verified by minting the token locally with the instance's own signing key and pasting it into the URL: A-005 (password reset), A-006 (email confirmation — "a real `email-verification` token minted from the instance's own key (the same method A-005 used)"), and S-024 (invitation acceptance — "minted locally with the instance's own signing key because this deployment has no working SMTP and no `mail.debugMode` archive to read one from"). The half that has never run is the half a real user takes: core-api composing the mail, the link surviving the mail client, the token arriving intact. Two aggravating details. The email-verification flip is not undoable — core-api has no un-verify endpoint — so it was exercised on a throwaway filler account (`seed.filler.25`) and every seeded persona is still unverified. And S-024's e2e spec "builds its own tokens with a signature that is not real", so the submit step is covered by nothing but the one manual run. G-019 (notifying teachers an exercise changed), the assignment publish notice and DEC-096's failure-resolve mail are in the same position.

**What would fix it.** Configure `mail.debugMode` with an archive directory, or a catch-all SMTP sink, and re-run A-004/A-005, A-006 and S-024 end to end from the actual mail. This is a one-afternoon operator task that converts the least-verified block in the product into the ordinary kind.

**Why it matters.** High for a rollout. Password reset and invitation acceptance are the two flows where a failure is invisible to the operator and total for the user, and they are the two flows with the least real coverage in the repo.

_Cited from:_ `Q-007`, `A-005`, `A-006`, `S-024`, `G-019`, `DEC-096`, `docs/PROGRESS.md:329-337`, `docs/PROGRESS.md:3230-3240`, `ASS-008`

### 3.5 Every refused page in the app answers HTTP 200, and F-012's verification claimed otherwise

Q-016 / DEC-069: `forbidden()` renders the right page — the reader is told in words that they may not see this — and the response status is 200. Measured with a probe route whose entire body was `forbidden()`: the `(app)` shell streams its first bytes before any page body runs, so the status line is written and gone. DEC-034 adopted `experimental.authInterrupts` specifically because it was "the only way to get a real 403/401 status code from the App Router", and inside `(app)` it does not deliver that. The verification failure is worth stating on its own: F-012's entry claims all four states were verified "including the HTTP status (403/401/500/404)" — true, in temporary standalone probe routes, and false for every route inside the app shell, which is every route that can be refused. The gap between those two facts went unnoticed from 2026-08-18 (F-012) to S-013 in late August. Q-016 is explicit that neither fix is affordable: deciding permission in `proxy.ts` costs a core-api round trip per navigation, and making `(app)` non-streaming trades every page's first paint.

**What would fix it.** Either accept it and record it as a known deviation in the README's security section (it currently is not there), or revisit when Next gives a way to set status after streaming begins. What should change regardless: verification of a cross-cutting behaviour must be done on a real route inside `(app)`, not on a probe route outside it.

**Why it matters.** Low impact for browser readers, who see the correct page; real for anything non-browser — monitoring, link checkers, API-ish clients, and any future integration that trusts status codes. High as a process finding: a probe route verified in isolation is not evidence about the shell.

_Cited from:_ `Q-016`, `DEC-069`, `DEC-034`, `F-012`, `S-013`, `F-030`, `DEC-070`, `docs/QUESTIONS.md:155-181`, `docs/PROGRESS.md:1321-1350`

### 3.6 All ~250 response types are hand-written, because core-api's OpenAPI spec has no response schemas at all

DEC-044, confirmed directly: core-api's `swagger.yaml` has no response schemas anywhere — all ~250 response definitions are literally `description: 'Placeholder response'`, with no `content`, no `schema`, and no `components.schemas` section in the whole 7409-line file. `openapi-typescript` therefore buys request bodies, path params and a `keyof paths` guarantee that an endpoint exists; every response payload resolves to `never` and must be hand-typed by the caller. The codegen input is a vendored, manually-refreshed snapshot at `openapi/core-api.yaml` (CI cannot reach the api repo), so it is a second copy that goes stale silently. The practical consequence is that this repo's model of core-api's responses is a large body of hand-written interfaces pinned to what a live instance happened to return on the day each ticket was written; nothing detects a core-api response change until a screen breaks in front of a user. Q-020 is the acute case of the same disease — the five exercise-configuration endpoints are `"Placeholder response"` with request bodies typed `array/items: {}`, so `lib/exercise-config/` now holds "a second copy of an unpublished contract" ported out of the legacy `configSimple.js` descriptor table.

**What would fix it.** Response schemas on core-api's operations — even partial ones — turn the largest hand-maintained surface in this repo into generated code. Failing that, an endpoint that serves the exercise-configuration descriptor table itself (Q-020's own ask) removes the worst copy. Meanwhile this repo should date-stamp `openapi/core-api.yaml` and add a CI step that diffs it against the api repo when both are checked out.

**Why it matters.** High, and it is the single item on this list most worth taking to the API team rather than fixing here. It is also the root cause of several other weaknesses in this section (Q-020's unverifiable descriptor variants, the unit tests that can only pin "the payloads that were actually observed").

_Cited from:_ `DEC-044`, `Q-020`, `F-022`, `openapi/core-api.yaml`, `lib/api/core-api.generated.ts`, `lib/api/client.ts`, `lib/exercise-config/`, `docs/QUESTIONS.md:264-290`

### 3.7 The 257-test e2e suite — the only thing that tests this app against a real API — is deliberately not in CI

DEC-045: `pnpm test:e2e` is "not wired into `.github/workflows/ci.yml`" because these tests need a real reachable core-api and GitHub Actions has neither one nor a way to stand one up from this repo alone (core-api/mysql live in the separate compose repo). That was a defensible call in F-023 when the suite was 48 tests; it is now 257 e2e tests plus `e2e/security.spec.ts`, which carries brief §8's "non-negotiable" token-leakage assertions (F-024/DEC-046: the session cookie really is httpOnly, and the raw token appears in no served HTML and no served JavaScript). CI runs `typecheck`, `lint`, `build`, `test` (170 unit tests, pure logic only) and `format:check`. So the checks that would catch an authentication regression, a permission regression or a token leak run only when a developer with a full compose stack remembers to run them. This repo has already demonstrated what that costs: `format:check` existed as a `package.json` script from F-002 and was in no pipeline until F-010 tripped over it — "a script existing in `package.json` isn't evidence it's actually enforced anywhere."

**What would fix it.** Stand the compose stack up in CI as a service job (core-api + mysql + the seed script) and run the e2e suite against it — the seed is idempotent and verified so, which is the hard part already done. If that is genuinely out of reach, at minimum run `e2e/security.spec.ts` on a schedule against a persistent staging instance, and say plainly in the README which suites CI does and does not run.

**Why it matters.** High. This is the largest asset the project built and the one with the weakest guarantee of ever running again. A successor team that does not read DEC-045 will reasonably assume a green CI badge covers the suite.

_Cited from:_ `DEC-045`, `DEC-046`, `F-023`, `F-024`, `F-005`, `F-010`, `.github/workflows/ci.yml`, `e2e/security.spec.ts`, `docs/PROGRESS.md:1701-1705`, `docs/PROGRESS.md:1276-1283`, `docs/PROGRESS.md:990`

### 3.8 Nothing about this app's performance has ever been measured, and two deferred decisions are waiting on the measurement

P-003 has since been run, and this section is what it found before it ran. Fifteen fixes landed and five were measured and filed as PF-001..PF-005; what follows is still accurate as the state that produced them. The fetching strategy is deliberately uncached — DEC-044 sets `cache: "no-store"` unconditionally on every request and wraps nothing in React's `cache()` except two per-request memoizations added in the 2026-08-21 review pass — and several screens fan out per group: the student dashboard makes one `/v1/groups/{id}/assignments` call per group for deadlines and one `/v1/groups/{id}/shadow-assignments` per group for S-025's rows; the teacher dashboard's deadline panel fans out one call per taught group; T-001's bulk assign is one request per group because core-api has no bulk call. Q-015 records that the group list fetches every group the caller can see and sorts, filters and pages it in the browser, with no server-side paging available on that endpoint ("checked") — fine at this deployment's four groups, explicitly wrong for an administrator on an instance with thousands. Q-013 records that the teacher activity feed was not built precisely because it would be "27 requests for the seeded superadmin alone, and unbounded for a real teacher." And both DEF-001 (`cacheComponents`/`partialPrefetching`) and DEF-002 (React Compiler) are deferred until "a performance baseline" that does not exist.

**What would fix it.** Run P-003 against a seeded instance sized like a real faculty, not this one — the numbers that matter are an administrator's group list and a teacher's dashboard fan-out. That measurement also unblocks DEF-001 and DEF-002, which have been waiting on it since May.

**Why it matters.** Unknown, which is the point. Every performance judgement in this repo is an argument from a four-group, 24-exercise, 31-user instance. The one place the docs do the arithmetic for a realistic instance (Q-013's 27 requests) is the one place they decided not to build the feature.

_Cited from:_ `P-003`, `docs/BACKLOG.md:182`, `DEC-044`, `Q-015`, `Q-013`, `DEF-001`, `DEF-002`, `S-025`, `T-001`, `docs/PROGRESS.md:2426`, `docs/PROGRESS.md:3249`, `docs/PROGRESS.md:501`, `docs/QUESTIONS.md:135-154`

### 3.9 Permissions are decided two different ways because core-api emits permission hints for exactly one entity

AD-001 established the fact plainly: "`permissionHints` turns out to be emitted for exactly one entity in the entire API (`GroupFormat`)". Everywhere else this app has to restate a core-api ACL rule from fields it happens to hold, and it has now done so at least four times: DEC-080 (a user object carries no hints, so the profile asks and reads the refusal), DEC-090 (joining and leaving a group are offered from the group's own fields), T-005 (`canViewStudentStats` is written against the student as well as the group, "so there is no hint to read — DEC-090's shape, third time"), and DEC-110 (the user list offers its account actions on the reader's role). Each restatement is a copy of a PHP rule that is free to drift from it, and drift is invisible: the app already knows this, which is why S-023 deliberately did _not_ mirror `archived` ("a second copy here would be free to drift") while mirroring expiry and `organizational`, which it had to. What keeps it honest is that every Server Action runs on the caller's own token, so core-api still decides what happens — but what is _offered_ can be wrong in either direction, and already surprised the authors once: a `supervisor-student` is refused the whole user list, "which is not what 'teachers see the user list' would have predicted."

**What would fix it.** For the API team: emit `permissionHints` on more than `GroupFormat` — it is the single change that would delete the largest category of guesswork in this frontend. For this repo: collect the restated rules into one module with the core-api file and rule name cited per rule, so a future ACL change has one place to check instead of four.

**Why it matters.** Medium now, high over time. Nothing is currently insecure — the token boundary holds — but the set of hand-copied rules will silently diverge from core-api's `permissions.neon` on the first ACL change, and there is no test that would notice.

_Cited from:_ `DEC-110`, `DEC-080`, `DEC-090`, `T-005`, `S-023`, `AD-001`, `docs/PROGRESS.md:705-710`, `docs/PROGRESS.md:3185-3187`, `docs/PROGRESS.md:54-58`

### 3.10 The exercise configuration editor rewrites a contract nobody publishes, and its writer shipped with a latent defect

T-009 built the configuration editor against five endpoints core-api describes as `"Placeholder response"` with request bodies typed `array/items: {}` (Q-020). The vocabulary — which variables exist, what they mean, the nine built-in judges — is published nowhere and was ported from the legacy `helpers/exercise/configSimple.js` into `lib/exercise-config/`. Three compounding weaknesses follow. (1) "Reading is permissive, writing normalises" — the writer rebuilds the pipeline list from the instance's catalogue, so **saving is not a no-op**: opening this screen on a configuration written by hand and pressing save rewrites it. (2) That writer shipped with a real defect and it was found by a later ticket, not by T-009: it carried forward every variable already in a pipeline, and core-api refuses a configuration holding a variable the pipeline does not declare (`Variable 'extra-files' is redundant in pipeline ...`) — surfaced only the first time T-024 wrote one. (3) DEC-101 correctly refused to rewrite an advanced configuration, and in doing so shipped a one-way door: an exercise switched to advanced had no way back out of this app until T-024 built the return path. Three parts of this screen have still never rendered with data (Q-020, six runtime environments).

**What would fix it.** Ask core-api for the descriptor table as an endpoint (Q-020 already frames it: the pipelines publish their `parameters`, which is what makes placement possible; what is missing is the variable list). Until then, add a startup or test-time assertion that every variable name `lib/exercise-config/` knows is still declared by some pipeline on the live instance — that is the check that would have caught the T-009 writer bug before T-024 did.

**Why it matters.** High for exercise authors, who are the users of this screen and the ones who lose work if the writer is wrong. The unpublished contract means the next core-api change to the descriptor table will break this silently — Q-020's own words: "an environment or a variable added to core-api will not appear here until somebody notices."

_Cited from:_ `Q-020`, `T-009`, `T-024`, `DEC-101`, `DEC-102`, `DEC-108`, `lib/exercise-config/`, `docs/PROGRESS.md:400-420`, `docs/PROGRESS.md:607-630`

### 3.11 Two screens deliberately show the same student two different statuses, and the wrong one is the student's own

DEC-068 vs Q-012. core-api builds a student's best-solution status from valid solutions only, so a student whose every attempt died in the pipeline has a `null` status — indistinguishable from a student who never started. The dashboard (S-001) resolves that to "Not submitted". S-013's teacher roster has `lastAttemptIndex` from `/v1/assignment-solvers`, so it resolves the same student to "Evaluation failed". The seeded student with eleven failed attempts therefore reads as "Not submitted" on her own dashboard and "Evaluation failed" on her teacher's. DEC-068's rejected-alternatives column takes the position explicitly: "consistency with a known-wrong label is not a virtue where better data exists." That is right per screen and wrong per product — the student is the person being told the least true thing, on the page she opens first, about her own work.

**What would fix it.** Q-012 already names the fix and its price: `/v1/assignment-solvers?groupId=&userId=` gives per-assignment attempt counts and would separate the two cases at one more request per group. Either pay it and make the dashboard agree with the roster, or route both screens through one shared status function so the divergence is a documented parameter rather than two independent implementations.

**Why it matters.** Medium, and currently only visible on a broken worker (Q-012 notes it "stops being visible" on a cgroup v1 host). But it is exactly the kind of divergence that survives into production as a support ticket nobody can reproduce, and the app now has two answers to one question with no shared helper enforcing either.

_Cited from:_ `Q-012`, `DEC-068`, `S-001`, `S-013`, `DEC-031`, `docs/QUESTIONS.md:65-88`, `docs/PROGRESS.md:2884-2890`

### 3.12 Shipped screens that are quietly incomplete, some with the code claiming otherwise

Five concrete instances P-001 surfaced, all in screens marked done. G-013: T-011's reference-solution detail renders each file as a non-interactive `<span>` with a name and a size, "and its own doc comment claims the opposite" — an author cannot read the solution that proves their own exercise works. G-004: the per-test `exitCode`/`exitSignal` are already fetched by `components/solutions/evaluation-results.tsx` and thrown away, so a student whose program crashed is told only "Failed". G-027: `components/solutions/review-comment.tsx:188` renders a reviewer's comment body in a bare `<p>`, so emphasis, lists, links and fenced code snippets arrive as literal asterisks and backticks — legacy has a dedicated dialog for inserting a code fence, and `lib/markdown/legacy-compat.ts:29-33` already escapes raw HTML so the one-line fix adds no injection surface. G-029: the reference-solution cell in T-019's failure table is inert text, and `lib/api/submission-failures.ts:47` carries a sentence claiming otherwise. G-024: `/faq` is still the last `PlaceholderPage` in the product, is public in `proxy.ts:34`, is registered in the breadcrumb manifest, and is the landing page's second call-to-action (`app/[locale]/(anon)/page.tsx:57-62`) — so the one page A-001 invites a visitor to open says "This page hasn't been built yet." Separately and self-reported: `components/users/account-forms.tsx` still puts each field's hint inside its `<label>` — the accessibility bug T-002 fixed elsewhere — "noted rather than swept in."

**What would fix it.** G-027 and G-029 are one-line and one-link changes; G-024 is either a server-side markdown fetch through the existing `components/markdown/markdown.tsx` or a `DROPPED.md` row **plus** removing the call-to-action that points at it. G-013 and G-004 are real work. Also: fix the two doc comments that assert capabilities the code does not have — a lying comment is worse than a missing one.

**Why it matters.** Individually small, collectively the reason "done" cannot be trusted in this repo's own status columns. G-024 is the embarrassing one: it is on the front page. G-013 and G-027 are the ones that make a built screen useless for its actual job.

_Cited from:_ `G-013`, `G-004`, `G-027`, `G-029`, `G-024`, `T-011`, `T-019`, `A-001`, `T-002`, `components/solutions/review-comment.tsx:188`, `lib/api/submission-failures.ts:47`, `app/[locale]/(anon)/page.tsx:57-62`, `proxy.ts:34`, `components/users/account-forms.tsx`, `docs/PROGRESS.md:3415`

### 3.13 Every Czech string in the product is unreviewed, and the only automated check cannot see a wrong translation

P-004 has since been run and changed 176 strings, but **not by a native speaker** — that dependency the project still cannot supply. The gap this section describes is therefore narrowed, not closed, for a Czech university's product, in a repo whose own rule counts `aria-label`, `title` and `sr-only` as user-facing text requiring both locales. The only tooling is `lib/i18n-text/messages.test.ts`, added by T-005, which asserts that both locales hold the same keys and that every literal key the source asks for exists. A present-but-wrong Czech translation passes it, and so does a key composed at runtime. The bug that prompted it was found by eye, not by tooling: `Profile.groupSolutions` rendered as its own key on the profile page, because next-intl prints the path rather than throwing and "nothing in `typecheck`/`lint`/`build` sees message keys at all." The same class of miss shipped before: D-003's `DataTable` chrome — pagination, the select-all label, the empty text — was hardcoded English and went unnoticed while its only caller was the design-system showcase; "a Czech reader would have seen it here" (S-004). Two pages carry deliberately hardcoded bilingual text by design (`app/global-error.tsx`, `app/global-not-found.tsx`, F-012), which is defensible and is also two more places nobody has proofread.

**What would fix it.** Run P-004 with an actual native speaker against the message catalogues, not against screenshots — and extend `messages.test.ts` to flag runtime-composed keys, which are the ones it structurally cannot check today.

**Why it matters.** Medium-high for adoption. Translation quality is the first thing a Czech user judges and the last thing this project measured; the count of strings involved is now large enough that a review is a real task, not a skim.

_Cited from:_ `P-004`, `docs/BACKLOG.md:183`, `T-005`, `lib/i18n-text/messages.test.ts`, `S-004`, `D-003`, `F-012`, `docs/PROGRESS.md:66-73`, `docs/PROGRESS.md:2597-2601`, `docs/PROGRESS.md:1342-1345`

### 3.14 A product privacy rule is enforced only in this app's own projection function

DEC-064: core-api's `canViewReview` is true for a solution's author from the moment a review exists; the legacy app and this app both withhold it until `closedAt` is set, because a half-written review is not a verdict and closing is what counts the issues and emails the author. This app implements that in `visibleReviewComments()`, and DEC-064 names it for what it is: "the one place in this app where the UI deliberately shows _less_ than the API would allow." The consequence is unstated in the decision and worth stating: a student holding their own valid token can read a reviewer's unfinished comments straight from core-api, and G-020 — an application-token form — is a filed ticket that would make doing so easy and legitimate. The rejected alternative ("asking core-api to withhold them") was refused on brief §3.1 grounds, which is correct scoping and leaves the rule unenforced.

**What would fix it.** This one belongs on core-api's side, and it is a small ask: gate `canViewReview` for the author on `closedAt`, matching what both frontends already do. Until then, DEC-064's note should say out loud that the rule is cosmetic — especially before G-020 ships.

**Why it matters.** Low likelihood, real consequence: a student reading a teacher's mid-sentence assessment of their work is precisely the harm the rule exists to prevent, and the protection is a client of the API choosing not to display something.

_Cited from:_ `DEC-064`, `S-018`, `G-020`, `docs/DECISIONS.md DEC-064 row`

### 3.15 The project's own documents were unreliable until the last two days of work

P-001 read all 138 INVENTORY.md rows against the code and found **65 status cells wrong**, in both directions — 40-odd still saying `todo` for screens that shipped months earlier, a dozen saying `done` for rows whose write half was never built. Its verdict: the file "had been consulted as the parity contract while saying almost nothing true about it since May." P-006 found ROUTES.md promising four routes that do not exist (`/groups/[id]/info`, `/reference-solutions/[id]`, `/admin/server`, `/[...not-found]`) and missing the change that breaks every legacy bookmark. P-007 found DROPPED.md listing twenty items, nineteen of them libraries, "inviting exactly the wrong inference" about what the app cannot do. P-005 found there was no README at all. And DEC-043 deferred two capabilities to "a future ticket" that was never filed, "which is precisely how an oversight comes to read as a decision" — now G-020 and G-023. Residue remains: `BACKLOG.md:72` still marks F-028 `blocked` while PROGRESS.md's Current Status says "Blocked tickets: None."

**What would fix it.** Two habits, both cheap. (1) Any status file that is consulted as a contract gets re-derived from the code on a schedule, not edited in place — P-001's method (two readers per claim, the second instructed to refute, "default to refuted when in doubt", which killed four of thirty-three claimed gaps) is the standard to keep. (2) A deferral is not allowed to exist without a filed ticket id — DEC-043's is the case that proves it. Reconcile F-028's two statuses now.

**Why it matters.** High for anyone inheriting this repo, which is the audience. PROGRESS.md itself is excellent and was written as work happened; every document written at plan time and consulted afterwards as fact was wrong, and only a deliberate audit in the final week revealed it.

_Cited from:_ `P-001`, `P-005`, `P-006`, `P-007`, `DEC-043`, `G-020`, `G-023`, `F-028`, `docs/INVENTORY.md:7-9`, `docs/PROGRESS.md:3489-3494`, `docs/PROGRESS.md:3536-3546`, `docs/BACKLOG.md:72`, `docs/PROGRESS.md:3688`, `docs/DROPPED.md:10-25`

### 3.16 The URL scheme has no compatibility layer, and the toolchain sits off the brief's stack

Two smaller structural weaknesses. (1) P-006: `localePrefix: "always"` means there is no `/dashboard` — there is `/en/dashboard` and `/cs/dashboard` — so every legacy bookmark that survives cutover lands on a 404 unless a redirect table exists. `next.config.ts` has no `redirects()` and `proxy.ts` rewrites nothing but the locale. This is harmless today only because nginx still serves the legacy app at `/` and this one answers on its own host port; R-004 is open because if both apps stay reachable, the `/app/:path*` catch-all must not be added at all or the legacy app becomes unreachable through its own URLs. Six legacy group routes collapse to one route plus a `?tab=`, so those redirects need query strings ordered before the catch-all. (2) F-028: TypeScript is pinned at 6.0.3 and ESLint at 9, against brief §4's explicit TS 7 (chosen so `next build` uses the native type checker). Re-checked 2026-09-02: `typescript-eslint@8.69.0` still peers `typescript: >=4.8.4 <6.1.0`, and the only remaining ESLint cap is `eslint-plugin-react@7.37.5`, transitive via `eslint-config-next`. Nothing in this repo can lift either. The app also depends on two experimental Next flags — `experimental.authInterrupts` and `experimental.globalNotFound` — and the first does not deliver the status codes it was adopted for.

**What would fix it.** Redirects: treat P-006's table as a pre-cutover deliverable with an owner, and settle R-004 (does the legacy app stay reachable?) before writing the catch-all. Toolchain: leave F-028 open as the recurring check it is, and reconcile its status with PROGRESS.md. Experimental flags: note both in the README's deployment section, since a Next upgrade can remove either.

**Why it matters.** The redirect gap is a cutover-day outage risk, not a code defect, and it is entirely an operator decision that has not been made. The toolchain pin is low severity and permanently recurring — it is upstream, not here.

_Cited from:_ `P-006`, `F-028`, `R-004`, `DEC-033`, `DEC-034`, `DEC-069`, `next.config.ts`, `proxy.ts`, `docs/ROUTES.md`, `docs/PROGRESS.md:3532-3552`, `docs/BACKLOG.md:304`

---

## 4. Where the legacy app is still better

The one-sentence version of this section is written in the project's own status line: "Every feature ticket of Phases 1--6 is done, and parity is nevertheless **not** met" (PROGRESS.md:3606-3609). P-001, the parity sweep, walked all 138 INVENTORY.md rows against the code on 2026-09-02, found 65 of the status cells wrong, and filed 29 capabilities that a person can reach in the legacy app and cannot reach here (BACKLOG.md:186-234). The sweep's own summary of the shape is more useful than the list: "this app reads well and writes badly" -- fourteen of the twenty-nine are a single button over an endpoint `lib/api/core-api.generated.ts` already types and no code calls (PROGRESS.md:3492-3499). I re-verified the sharpest half-dozen claims directly against the tree and every one held, several more starkly than the ticket that filed it. Grouped by theme, the 29 fall into: the teacher's entire grading verdict (6), the inability to create three of the domain's core entities (3), authoring and reading what you authored (7), comparison and preview tools (3), self-service account and security (4), and a long tail of one-click affordances (6). Beyond missing features, three structural changes cost the app something the legacy had: the header bar was removed and took two affordances with it, `localePrefix: "always"` breaks every existing bookmark, and two deliberate decisions (DEC-059, DEC-094) traded a legacy one-click control for navigation on reasoning that is defensible but should be named as a trade rather than an improvement. Where the redesign is clearly better it is better on security, correctness and server-rendering, and I have kept that to one item as instructed.

### 4.1 Parity is not met, and the phase history was structurally incapable of saying so

PROGRESS.md's own status section now opens by retracting what it had been reporting: "P-001 has been run and the picture it returned is not the one this section had been reporting. Every feature ticket of Phases 1--6 is done, and parity is nevertheless not met: 29 capabilities reachable in the legacy app are not reachable here" (PROGRESS.md:3606-3611). It then names the reason the history could not have caught it: the phase history is "accurate about what was built and silent about what was left off each screen." The inventory that was supposed to be the parity contract had rotted in both directions -- P-001 found 65 of 138 status cells wrong, with 40-odd rows still saying `todo` for screens that shipped months ago and a dozen saying `done` for rows whose write half was never built, and concluded the file "had been consulted as the parity contract while saying almost nothing true about it since May" (PROGRESS.md:3486-3491). INVENTORY.md's own header now admits the same: statuses were "written during recon and then left alone for four months" (INVENTORY.md:7-9).

**What would fix it.** The mechanism P-001 used is the fix and should be made recurring, not a one-off Phase 7 ticket: re-derive every inventory status from the code at the close of each phase, never from the plan. P-001's second discipline is worth keeping too -- every claimed gap went to a second reader instructed to refute it, defaulting to refuted in doubt, and four claims died there (PROGRESS.md:3513-3521).

**Why it matters.** Highest. This is not one missing feature but the failure mode that hid twenty-nine of them for four months. A parity contract consulted but never re-derived is worse than no contract, because it manufactures false confidence -- six phases were declared complete against it.

_Cited from:_ `P-001`, `PROGRESS.md:3484-3528`, `PROGRESS.md:3604-3611`, `INVENTORY.md:7-9`, `BACKLOG.md:186-196`

### 4.2 The teacher's entire verdict on a solution is missing -- six gaps on one screen

The solution screen renders everything and can change nothing. G-001: accept-as-final (`POST /v1/assignment-solutions/{id}/set-flag/accepted`) and the points override (`/bonus-points`) -- zero, full, clear, or an explicit override, with legacy's cap at the assignment maximum before the deadline. G-002: resubmit, resubmit-all and delete (`/resubmit`, `/exercise-assignments/{id}/resubmit-all`, `DELETE`) -- BACKLOG.md:208 calls this "the only way to re-grade work after fixing a broken test or limit." G-004: the evaluation runs behind a solution, gated on `viewResubmissions`, including legacy's "this is not the run it is scored by" warning and the result archive. G-006: `download-best-solutions`, one archive of every student's best attempt. G-014: the same history on the reference-solution side. INVENTORY.md:39-41 accordingly marks the solution detail route `partial (G-001..G-004)` and the solutions list `partial (G-002, G-006)`. Two details make this worse than a to-do list. First, "The badge for the accepted flag is already rendered everywhere; nothing can set it" (BACKLOG.md:207). Second, G-004's per-test `exitCode`/`exitSignal`: I confirmed `exitCode: number | null` is mapped into the app's own model at `lib/api/solution.ts:32` and rendered by nothing -- the value is fetched and discarded -- so, in the ticket's words, "a student whose program crashed is told only 'Failed'" (BACKLOG.md:210). `exitSignal` is not even mapped.

**What would fix it.** Six controls against endpoints already typed in `lib/api/core-api.generated.ts`. G-004's exitCode is the cheapest and highest-value: the data is already in `lib/api/solution.ts`; it needs a render and the per-environment name mapping. Build G-004 and G-014 together, since BACKLOG.md:216 notes "the two should be built to look alike."

**Why it matters.** Highest of the feature gaps. Grading what the pipeline got wrong is the teacher's core act, and this app cannot perform any part of it. G-002 additionally means a broken test or limit cannot be corrected retroactively at all -- the class's marks stay wrong.

_Cited from:_ `G-001`, `G-002`, `G-004`, `G-006`, `G-014`, `BACKLOG.md:207-216`, `INVENTORY.md:39-41`, `lib/api/solution.ts:32`

### 4.3 S-002 built the teacher's review queue and nothing in this app can put a solution into it

P-001 calls G-003 "the sharpest instance" of the whole pattern (PROGRESS.md:3498-3499). I verified it and it is sharper than the ticket says. `reviewRequested` is mapped out of core-api in four API modules (`lib/api/assignment.ts:175`, `lib/api/assignment-solutions.ts:95`, `lib/api/assignment-solvers.ts:89`, `lib/api/solution.ts:157`), counted into a dashboard statistic (`lib/api/assignment-solvers.ts:119` -- `reviewRequests: solvers.filter(...).length`), and rendered as a badge in four separate places: `components/assignments/solution-list.tsx:75-76`, `components/assignments/solver-table.tsx:98-99`, `components/assignments/solutions-table.tsx:180,192`, and `app/[locale]/(app)/solutions/[solutionId]/page.tsx:76-77`. The writer does not exist: `set-flag` appears exactly once in the whole repo, at `lib/api/core-api.generated.ts:2243`, in the generated types. A student cannot ask for a review; the queue, the count and the four badges are permanently empty on this deployment except where core-api's data was seeded by other means.

**What would fix it.** One button and its cancel on the solution screen and its sources page, offered on `setFlagAsStudent`/`setFlag` while no review is open (BACKLOG.md:209).

**Why it matters.** High, and it is the clearest evidence for the systemic point. Nine code sites were built to display a state that no code path can produce -- nobody noticed because an empty queue looks exactly like a queue with nothing in it, the same failure mode DEC-058 describes for the sidebar's "My Teaching" section ("an absent optional section looks exactly like a correct one").

_Cited from:_ `G-003`, `S-002`, `BACKLOG.md:209`, `PROGRESS.md:3496-3499`, `lib/api/assignment-solvers.ts:89,119`, `components/assignments/solution-list.tsx:75-76`, `lib/api/core-api.generated.ts:2243`, `DEC-058`

### 4.4 Three of the domain's core entities cannot be created at all

G-008: "A course cannot be started in this app." The group hierarchy "can be read, renamed, moved, archived and deleted, and never extended" (BACKLOG.md:206). I confirmed the grep the ticket cites -- searching `createGroup` across `lib`, `components` and `app` returns only `createGroupInvitation` (`lib/actions/group-invitation.ts:68` and its one caller). `POST /v1/groups` is never called. G-009: a shadow assignment cannot be created or edited; reading and the points lifecycle shipped with S-020/T-024 but the entity's own CRUD did not, "which is why `scripts/seed.ts` makes them by raw API call" (PROGRESS.md:3502-3504, BACKLOG.md:211). G-016: `createPipeline()` is defined at `lib/actions/pipeline.ts:130` and I confirmed it has zero callers anywhere in the repo -- forking an existing pipeline is the only route to a new one, "which fails on an instance that has none" (BACKLOG.md:218).

**What would fix it.** All three are creation forms over endpoints already typed. BACKLOG.md:206 specifies the shape: apply DEC-093's create-first-configure-second pattern -- create with defaults, land on the settings screen -- rather than a wizard, for the reason DEC-093 and DEC-098 both give (nothing is lost if the tab closes halfway).

**Why it matters.** Highest. G-008 alone means the app cannot be adopted: an instance's first act is creating a group, and there is no screen for it. G-016 is a cold-start failure -- a fresh instance with no pipelines can never acquire one through this app.

_Cited from:_ `G-008`, `G-009`, `G-016`, `BACKLOG.md:206,211,218`, `PROGRESS.md:3502-3504`, `lib/actions/pipeline.ts:130`, `lib/actions/group-invitation.ts:68`, `DEC-093`, `DEC-098`

### 4.5 The solution diff is the one brief §7 landmine that was stepped on -- a whole screen, not a control

P-001 checked both of the brief's flagged landmines: "Pipeline visualisation survived; solution diffing did not" (PROGRESS.md:3505-3510). G-005 is named in three separate INVENTORY.md rows -- the route `/diff/:secondSolutionId` (line 39), the **Diff viewer** mechanism row (line 153) and the Domain Landmines row whose Action Required column reads "Keep capability" (line 166) -- and "nothing was built -- no route, no component, no dependency." It is, in P-001's words, "the one gap here that is a whole screen rather than a control." The legacy capability is specific: pick a second solution, diff paired files in two columns, swap sides, and hand-map files whose names differ, remembered per pair, with reviews deliberately hidden in diff mode (BACKLOG.md:212). DROPPED.md:75 refuses to let this hide in the library table: `react-diff-viewer` was replaced by "**Nothing.** This one is not a library swap, and it is not a drop either." P-006 records the second-order cost -- the redirect table has a row with nowhere to point, because "a redirect to an unbuilt route is a 404 with an extra hop" (PROGRESS.md:3551-3553).

**What would fix it.** No new dependency needed -- BACKLOG.md:212 specifies reusing S-017's file loading and `lib/code/highlight.ts`'s tokens the way `reviewable-code.tsx` already does, mounted at `?compare=` on the sources page or a `/diff/[otherId]` route.

**Why it matters.** High. BACKLOG.md:212 names the workflow it removes: "This is how a teacher compares a student's successive attempts without going through plagiarism detection." The remaining routes to that question are the similarity report (S-019), which answers a different and more accusatory question, or two browser tabs.

_Cited from:_ `G-005`, `DROP-012`, `PROGRESS.md:3505-3510`, `PROGRESS.md:3551-3553`, `BACKLOG.md:212`, `INVENTORY.md:39,153,166`, `DROPPED.md:75`

### 4.6 An author cannot read the reference solution that proves their own exercise works -- and the code says otherwise

G-013 is the one gap where the code carries a doc comment contradicting what it does. At `app/[locale]/(app)/exercises/[exerciseId]/reference-solutions/[solutionId]/page.tsx:30` the file's own comment reads "The files are named and downloadable through the same route S-017 built for a student's"; the render at lines 96-105 is two inert `<span>` elements -- `<span className="truncate font-mono">{file.name}</span>` and a `formatBytes(file.size)` beside it. No link, no download, no viewer. BACKLOG.md:215 states the consequence plainly: "An author cannot read the solution that proves their own exercise works." The endpoint exists (`/v1/reference-solutions/{id}/download-solution`) and the viewer exists (S-017's `/solutions/[id]/sources`). Alongside it, G-015: no screen lists, uploads, replaces, removes or downloads a pipeline's supplementary files, "and the seeded pipelines reference one (`runner.py`), so a pipeline whose file needs replacing has to be fixed outside this app" (BACKLOG.md:217).

**What would fix it.** G-013 is small -- the download route and the existing source viewer both exist; wire them and delete the false comment. G-015 should be modelled on `components/exercises/exercise-files.tsx` and reuse D-005's chunked upload Route Handler (BACKLOG.md:217).

**Why it matters.** High for G-013 and it should be treated as a defect rather than a gap, because the doc comment means a future reader will assume it works. G-015 is high too: it forces an operator out of the app entirely to do routine maintenance on seeded infrastructure.

_Cited from:_ `G-013`, `G-015`, `T-011`, `BACKLOG.md:215,217`, `app/[locale]/(app)/exercises/[exerciseId]/reference-solutions/[solutionId]/page.tsx:30,96-105`

### 4.7 An assignment cannot have its own text, so editing one assignment's wording edits every assignment made from that exercise

G-007: `POST /v1/exercise-assignments/{id}/localized-texts` is never called. "Today an assignment's text is whatever its exercise says, changeable only by editing the exercise (which changes every assignment made from it) or re-syncing from it" (BACKLOG.md:213). This is not a missing button but a workflow that became destructive: the legacy app's own warning that overriding diverges the assignment from its exercise "is the point of the screen," and T-002's sync notice already reports exactly that divergence from the other side -- so this app renders one half of a two-sided mechanism. INVENTORY.md:38 marks `assignment/:assignmentId/edit` `partial (G-007)`.

**What would fix it.** The per-locale name/body/link form carrying `version`, on the assignment edit screen that already exists.

**Why it matters.** High, and higher than its position in the backlog suggests. A teacher who wants to add one clarifying sentence to their own class's copy of a shared exercise has only one lever, and pulling it silently rewrites the text for every other course using that exercise. The safe workaround is to fork the exercise, which fragments the catalog.

_Cited from:_ `G-007`, `T-002`, `BACKLOG.md:213`, `INVENTORY.md:38`

### 4.8 Self-service account security: the BFF half shipped, the form never did

Four gaps, and DROPPED.md:60-63 is explicit that these read as decisions and were oversights: "Both were _deferred_ in DEC-043 to 'a future ticket', and that ticket was never filed -- which made them read as decisions when they were oversights... A deferral with no ticket behind it is not a drop." G-020, application tokens: F-021 built and live-verified the route, and DEC-043 deliberately returns the raw token in the response body "for exactly this" purpose -- yet I confirmed `app/api/auth/restricted-token/route.ts` has no caller anywhere in the repo (the only other hits are its own doc comments and the generated types). G-023, narrowing one's own effective role -- legacy's sidebar "view as role X" toggle, which DEC-043 describes in detail as the second consumer of the same endpoint. G-021, signing out of every session: "AD-002 built this for an administrator acting on somebody else; the owner of an account cannot do it to themselves" -- BACKLOG.md:221 calls it "the security action a person takes after losing a laptop." INVENTORY.md:146 marks **Restricted tokens** `partial (G-020, G-023)`.

**What would fix it.** G-020 and G-021 are both sections on `/profile/edit` over code that already exists. G-023 needs `effectiveRole` plus an `establishSession()` call, superadmin only. BACKLOG.md:228 states the alternative honestly: build it "or promote DEC-043's deferral into a `DROPPED.md` entry."

**Why it matters.** High for G-021 specifically -- it is a security control an account owner has in the legacy app and does not have here, and the implementation (`invalidateUserTokens(viewer.id)` plus this app's own logout route) already exists in the codebase pointed at other people. G-020 is the clearest instance of half-built work: a complete, tested, live-verified backend with no user-facing entry point.

_Cited from:_ `G-020`, `G-021`, `G-023`, `F-021`, `AD-002`, `DEC-043`, `BACKLOG.md:220-221,228`, `DROPPED.md:60-63`, `INVENTORY.md:146`, `app/api/auth/restricted-token/route.ts`

### 4.9 Markdown is authored blind and displayed raw -- two gaps, one of them a one-line fix

G-027: I confirmed `components/solutions/review-comment.tsx:188` renders a reviewer's comment as `<p className="whitespace-pre-wrap">{comment.text}</p>` -- a bare paragraph. "A reviewer's emphasis, lists, links and fenced snippets arrive as literal asterisks and backticks -- legacy has a dedicated dialog for inserting a code fence" (BACKLOG.md:230). The ticket notes it is a one-line change to `<Markdown source={...} />` and that `lib/markdown/legacy-compat.ts:29-33` already escapes raw HTML, so it adds no injection surface. G-028: "Exercise and assignment texts, assignment hints, group descriptions, system messages and pipeline descriptions are all authored in a bare `<textarea>` with no way to see the result before saving. It matters most for exercise texts carrying KaTeX, where a delimiter mistake is invisible until a student reads it" (BACKLOG.md:232). These are the residue of DROP-011: `react-ace` was replaced by "Nothing yet -- no in-browser code editor exists," which is why G-028 "is the only thing left of the 'CodeMirror 6' plan" that DEC-013 committed to and INVENTORY.md:152 still advertises in its Code highlighting row (now `partial (G-028)`).

**What would fix it.** G-027: swap the `<p>` for the existing server `Markdown` component. G-028: a shared field with a preview tab rendering through the same component -- and, per BACKLOG.md:232, "building it or dropping it closes that row either way."

**Why it matters.** Medium-high, and disproportionate to the cost. G-027 is one line and is currently making the review feature -- S-018, one of the more carefully built screens in the app -- read worse than the legacy equivalent for any reviewer who uses formatting. G-028's KaTeX case is the genuinely damaging one: the author never sees the error, the student does.

_Cited from:_ `G-027`, `G-028`, `DROP-011`, `DEC-013`, `S-018`, `BACKLOG.md:230,232`, `components/solutions/review-comment.tsx:188`, `INVENTORY.md:152`, `DROPPED.md:73`

### 4.10 The exercise catalog lost both of its narrowing filters, so finding an exercise means searching the whole instance

Two gaps that compound. G-018: `filters[authorsIds][]` with options from `/v1/exercises/authors`, plus "legacy's one-click 'Mine' using the session's own id" -- "T-020 built the catalog's search and paging and left the author filter out; on an instance with thousands of exercises 'show me mine' is the query an author actually makes" (BACKLOG.md:225). G-010: attaching and detaching an exercise to a group exists (`lib/actions/exercise.ts:121,135`) but "the read side of the same relationship does not, so a teacher opening a course cannot answer 'what exercises does this course have?' and T-001's picker starts from the whole instance catalog" (BACKLOG.md:224). I confirmed both against the tree: `getAssignableExercises` at `lib/api/exercises.ts:179` takes only a locale and a search string, and its single caller at `app/[locale]/(app)/groups/[groupId]/assign/page.tsx:44` passes nothing else; `authorsIds` appears nowhere in the app outside the generated types.

**What would fix it.** Both are query parameters on endpoints already in use -- `filters[authorsIds][]` on the catalog, `filters[groupsIds][]=<groupId>` defaulted on from the group's assign page with a control to widen (BACKLOG.md:224-225).

**Why it matters.** Medium, rising with instance size. This is a shape regression as much as a missing feature: DEC-093 deliberately made the picker's search a server round trip because "an instance can hold thousands," which is precisely the scale at which a full-catalog search with no author or group narrowing stops being usable. The legacy app answered both questions in one click.

_Cited from:_ `G-010`, `G-018`, `T-001`, `T-020`, `DEC-093`, `BACKLOG.md:224-225`, `lib/api/exercises.ts:179`, `app/[locale]/(app)/groups/[groupId]/assign/page.tsx:44`

### 4.11 The header bar was removed, and two legacy affordances went with it

This is the clearest case where the new IA's shape, not an unbuilt ticket, is what costs the capability. AD-007 states it directly: "The legacy app hides active messages behind a bell in its header with an unread badge; **this shell has no header bar to hang one on**" (PROGRESS.md:921-923). The team's answer was a full-width banner across every page (DEC-115), argued on the grounds that "a broadcast is the instance saying evaluation is down -- worth reading without opening a dropdown." That is a reasonable trade for outages and a worse one for routine notices, and it comes with a coarser read model: "'Read' is one timestamp, and it has to be" -- dismissing covers whatever is on screen and a later message brings the banner back, because core-api stores no per-message flag (PROGRESS.md:925-928). The second casualty is G-025, the QR code of the current page, which INVENTORY.md:155 records as living in legacy's **Header dropdown** with the destination column also reading "Header dropdown" -- a destination that no longer exists. The ticket has to relocate it to the sidebar footer, and notes `grep -rin qr` over `app`, `components` and `lib` returns nothing. BACKLOG.md:223 names the use: "It is how a lecturer puts the page they are showing onto the room's phones."

**What would fix it.** G-025 needs no API and no session -- a client island encoding the current URL, placed beside the locale switch in the sidebar footer. The bell's unread-per-message behaviour cannot be restored without storage core-api does not have, and that limit should be recorded as such rather than left implicit.

**Why it matters.** Medium. Neither loss is severe alone, but together they show a structural change made for good reasons (density, no chrome) quietly deleting the home of two unrelated affordances, with no ticket noticing until the parity sweep. The QR code is also a brief §7 "easy to miss" item that was, in fact, missed.

_Cited from:_ `G-025`, `AD-007`, `DEC-115`, `PROGRESS.md:921-928`, `INVENTORY.md:155,170`, `BACKLOG.md:223`

### 4.12 The long tail: five one-click legacy affordances that became a workaround, a dead end, or nothing

G-011, mailing the whole class: legacy offers a one-click `mailto:?bcc=` over every student from the Students tab, on the group's `sendEmail` hint. Filed as partial rather than lost only because "T-007's points export already carries the addresses, so the workaround is to download a CSV" (BACKLOG.md:231) -- one click became export, open, extract a column, paste. G-029, a submission failure's reference solution: the cell in T-019's table is inert text where it should link to `/exercises/{exerciseId}/reference-solutions/{referenceSolutionId}`, and BACKLOG.md:234 notes the stale sentence claiming otherwise survives in two places including `lib/api/submission-failures.ts:47`. G-017, a pipeline's structure as a file: no export or import, so a definition cannot move between instances or be edited outside the app. G-019, telling teachers an exercise changed (`POST /v1/exercises/{id}/notification`), unverifiable end-to-end here only because of Q-007's missing SMTP -- which is already true of two shipped features. G-012, a group's external SIS attributes, cosmetic on this deployment but currently reading as an oversight rather than a decision.

**What would fix it.** G-029 is minutes. G-011 is a `mailto:` link. G-012 and G-019 should each get either a build or a DROPPED.md row -- BACKLOG.md:233 says of G-012 that it is "worth a `DROPPED.md` line beside the SIS decision if it is not built, so it stops reading as an oversight."

**Why it matters.** Individually low to medium; collectively this is the "eight years of accumulated fixes" the brief warns about. Each one is a small convenience somebody asked for at some point, and none of them was on any ticket's radar because each lived on a screen whose ticket said "render X".

_Cited from:_ `G-011`, `G-012`, `G-017`, `G-019`, `G-029`, `T-007`, `T-019`, `Q-007`, `BACKLOG.md:219,226,231,233,234`, `lib/api/submission-failures.ts:47`

### 4.13 The landing page invites every visitor to click through to "This page hasn't been built yet"

G-024 is the last `PlaceholderPage` in the product and it is the one page a visitor is actively sent to. I confirmed the call-to-action: `app/[locale]/(anon)/page.tsx:57-62` renders a `<Link href="/faq">` as the second button beside Sign in. The route is kept public by `proxy.ts:34` and is registered in the breadcrumb manifest, so everything about it works except the content. P-001 flagged it in exactly those terms: "the one page a visitor is invited to open says 'This page hasn't been built yet'" (PROGRESS.md:3511-3514). The legacy behaviour is modest -- fetch an operator-configured markdown document (`FAQ_URI`, per-locale, defaulting to the project wiki) and render it with a "content could not be loaded" callout. Note the ordering that produced this: A-001, the landing page, was one of the last feature tickets closed (PROGRESS.md:3650-3653), and it shipped a link to a placeholder that had been sitting there since Foundation.

**What would fix it.** BACKLOG.md:222 gives the two acceptable outcomes and rules out the third: a server-side fetch through the existing `components/markdown/markdown.tsx`, "or drop it in `DROPPED.md` **and** remove the call-to-action that points at it." Leaving the button pointing at a placeholder is the one option that is not available.

**Why it matters.** Medium in function, high in impression. This is the first thing an evaluator or a new user sees, and it is the single most embarrassing artifact in the app. It also contradicts DEC-066's own stated rule, applied rigorously elsewhere in this codebase, that a screen must not ship a link to a route nobody has written -- PROGRESS.md:123 and 3369-3370 both record links deliberately withheld for exactly that reason.

_Cited from:_ `G-024`, `A-001`, `DEC-066`, `PROGRESS.md:3511-3514`, `BACKLOG.md:222`, `app/[locale]/(anon)/page.tsx:57-62`, `INVENTORY.md:26`

### 4.14 The registration form lost its GDPR consent tick -- the one field on it that exists for a legal reason

G-026: "Legacy's registration form requires an explicit GDPR consent tick before an account can be created, and the accept-invitation form creates an account too. **The one element of that form that exists for a legal reason rather than a functional one**, and A-003 did not carry it across" (BACKLOG.md:229). INVENTORY.md:29 marks the registration route `partial (G-026)`. The context makes the omission easier to explain and no more acceptable: A-003 shipped with local registration disabled on this deployment (`ALLOW_LOCAL_REGISTRATION` is off, Q-019), so the form "explains rather than offering a form core-api would refuse" (PROGRESS.md:363-368) -- meaning the missing field was never rendered, never tested, and never seen by anyone reviewing the ticket.

**What would fix it.** Restore the consent checkbox on both account-creating forms -- BACKLOG.md:229 calls it "Cheap to restore." The alternative it names is explicit: "if the rewrite decided consent belongs elsewhere, that decision needs recording instead." No such decision exists in DECISIONS.md.

**Why it matters.** High as a class of risk, low as an amount of work. Every other gap in this list costs somebody time; this one is the only one with a compliance dimension, and it is the only gap where shipping as-is on an instance that does enable local registration would be a legal problem rather than a usability one. It also affects the accept-invitation path, which creates accounts and is enabled.

_Cited from:_ `G-026`, `A-003`, `Q-019`, `BACKLOG.md:229`, `INVENTORY.md:29`, `PROGRESS.md:363-368`

### 4.15 Two deliberate shape trades where the legacy control was arguably better, and should be named as trades

DEC-059 removed the legacy dashboard's inline close-review button from the pending-reviews list, reasoning that "a control that does it from a summary row, one click away, without the reader having opened the solution, is a worse affordance than the extra navigation it saves" (DECISIONS.md:84; PROGRESS.md:2512-2515 records the same). That is a genuine product judgement, and it is also a teacher's bulk workflow -- closing ten reviews after an evening of marking -- turned from ten clicks into ten navigations. DEC-094 replaced the legacy per-student screen's default stack of boxes per assignment with a single flat table, on better ground: the grouping becomes a sort, which "puts the choice in the URL where it is shareable" and adds a filter the boxes could not do. But note what went with it -- legacy kept that choice in `localStorage` per user, and this app deliberately has no per-user view preferences at all (G-022, DROP-C03). The two decisions share a pattern worth naming: the redesign consistently prefers a shareable URL and a single canonical layout over a saved personal preference and a one-click shortcut. That is a defensible house style, but it is a trade, and DROP-C03 is the only place any of it is written down -- as a provisional row that "may move".

**What would fix it.** No fix required, but G-022 forces the question and should be answered rather than deferred again: BACKLOG.md:227 says "**Either build the two or record all seven in `DROPPED.md` item by item**; what is not acceptable is the current silence." Of legacy's seven Visual Settings, two (`defaultPage`, `dateFormatOverride`) still mean something in this IA; five describe interactions this IA does not have.

**Why it matters.** Low individually, medium as a pattern. These are the section's fairest cases: both were reasoned, both were recorded, and either could be argued the other way. They matter because they show the redesign's taste systematically costing a class of affordance -- saved preferences and summary-row actions -- that eight years of legacy accretion had built up.

_Cited from:_ `DEC-059`, `DEC-094`, `G-022`, `DROP-C03`, `DECISIONS.md:84,119`, `PROGRESS.md:2512-2515`, `PROGRESS.md:45`, `BACKLOG.md:227`, `DROPPED.md:52`

### 4.16 Every existing bookmark into the legacy app currently breaks, and the fix is a deployment task nobody has scheduled

P-006 rewrote ROUTES.md and found the recon plan had promised four routes that do not exist (`/groups/[id]/info`, `/reference-solutions/[id]`, `/admin/server`, `/[...not-found]`), then found the larger problem: "`localePrefix: \"always\"` means there is no `/dashboard` -- there is `/en/dashboard` and `/cs/dashboard`. A redirect table that ignores that sends every bookmark to a 404" (PROGRESS.md:3535-3539). The second-order version is the IA collapse itself: "Six legacy group routes are one route and a `?tab=`, so those redirects need a **query string**, not a path rewrite -- and they have to be ordered before the generic `/app/:path*` rule or it swallows them" (PROGRESS.md:3540-3543). Two redirects lose information on purpose and the file says so: `/login/:redirect*` drops its target, and both legacy instance routes land on the merged screen (DEC-113). Today "Nothing redirects... `next.config.ts` has no `redirects()` and `proxy.ts` rewrites nothing but the locale," which is harmless only because nginx still serves the legacy app at `/`. R-004 is open on the consequence: if both apps stay reachable, the `/app/:path*` catch-all must not be added at all, "or the legacy app becomes unreachable through its own URLs."

**What would fix it.** The table exists in ROUTES.md; what does not exist is the `redirects()` implementation, the locale-prefix handling on every row, the query-string rows for the group tabs ordered ahead of the catch-all, and the operator decision in R-004 about whether both apps stay reachable.

**Why it matters.** Medium now, high at cutover. This is the one item in this section that is not a missing feature but a scheduled failure: on the day the new app takes over `/`, every link in every syllabus, email and bookmark bar breaks unless a redirect table that does not yet exist has been written and correctly ordered. And two of its rows (G-005, G-009) cannot be written at all until those tickets ship, because "a redirect to an unbuilt route is a 404 with an extra hop."

_Cited from:_ `P-006`, `R-004`, `DEC-113`, `G-005`, `G-009`, `PROGRESS.md:3530-3553`

### 4.17 DROPPED.md is now the model for how to tell a decision from a hole -- and it names its own two untidy rows

Worth recording because it is the process fix this project already made. P-007 found the recon draft of DROPPED.md "invited exactly the wrong inference": twenty items, nineteen of them libraries, "swapping `moment.js` for `date-fns` drops nothing a person can do" (PROGRESS.md:3554-3557; DROPPED.md:12-16). A reader could reasonably have concluded the file enumerated everything absent from the new app. It now splits what is absent three ways -- a deliberate drop with a decision id (four rows), work not yet done (the G block), and a replaced library -- and states outright: "If you are looking for 'what does the new app not do', the answer is the **second** row, not this file" (DROPPED.md:24-25). Only four capabilities were genuinely dropped: DROP-C01 (returning to your own account after a takeover, DEC-112 -- core-api's takeover token "carries nothing that says whose doing it was", so there is nothing to switch back to), DROP-C02 (settings collected during a bulk assign, DEC-093), DROP-C03 (the seven view preferences, provisional, pending G-022), and DROP-C04 (`URL_PATH_PREFIX` as a runtime rather than build-time setting). The file then refuses to tidy away its two most awkward rows -- DROP-011 (`react-ace` → "Nothing yet") and DROP-012 (`react-diff-viewer` → "**Nothing.**") -- with the note that these are "the two places where 'we replaced the library' quietly meant 'we did not replace the capability'" (DROPPED.md:77-79).

**What would fix it.** Apply the same test to the remaining ambiguous rows: DROP-C03 must resolve through G-022, and G-012 and G-023 both need either a build or a DROPPED.md row with a decision id, since both currently read as oversights.

**Why it matters.** Not a defect -- this is the section's evidence that the project can diagnose itself. The rule it lands on is the transferable one: "A row without a decision id is a G-ticket wearing a disguise" (DROPPED.md:88-89).

_Cited from:_ `P-007`, `DROP-C01`, `DROP-C02`, `DROP-C03`, `DROP-C04`, `DROP-011`, `DROP-012`, `DEC-112`, `DEC-093`, `DROPPED.md:12-25,52,73-79,88-89`, `PROGRESS.md:3554-3557`

### 4.18 The counterweight, kept brief: where the redesign is unambiguously better

Security and correctness, mostly. Auth: the token lives in an httpOnly cookie behind a BFF and never reaches client JS, against legacy's localStorage, which DEC-006's rejected-alternatives column labels "legacy — insecure". Correctness: T-007's CSV export does not reproduce a real legacy bug -- legacy's `escapeString` is JavaScript escaping applied to a CSV field, so it backslash-escapes an embedded quote where RFC 4180 doubles it, and "A student named `O\"Brien` breaks the legacy file and not this one", unit-tested (PROGRESS.md:92-96). D-005's uploader degrades a digest check to a skip where `crypto.subtle` is absent, which on plain HTTP is exactly "this very deployment" -- and there "the legacy app throws a bare `TypeError`" (PROGRESS.md:1967-1972). Rendering: code highlighting and markdown are server-side (Shiki, DROP-010), and DEC-107 lays out and draws pipeline graphs on the server with no Graphviz at all -- not by preference but because the modern WASM build "crashes on real ReCodEx pipelines", reduced to ten record nodes with an empty leading cell. Navigation: INVENTORY.md:156 records legacy's breadcrumbs as "Missing/inconsistent" against a central manifest here. And the rewrite found genuine legacy-side defects on the way, including DEC-058's group-admin derivation, where "My Teaching" had never rendered for any seeded persona.

**What would fix it.** n/a

**Why it matters.** Context only. This belongs in the retrospective as one short paragraph, not as a rebuttal -- none of it offsets the fact that a course cannot be created and a solution cannot be graded.

_Cited from:_ `DEC-006`, `DEC-058`, `DEC-107`, `DROP-004`, `DROP-010`, `T-007`, `D-005`, `PROGRESS.md:92-96`, `PROGRESS.md:1967-1972`, `INVENTORY.md:156`

---

## 5. What a human should check first

The notes are unusually honest about their own blind spots, and they cluster into four kinds: (a) an evaluation sandbox that has never produced a passing test on this machine, which silently voids most of the student-facing product; (b) an SMTP host that is literally `smtp.example.com`, so every email flow was verified by minting JWTs with the instance's own key rather than by reading a message; (c) a seed instance of 4 groups and 31 users, against which every scale, performance and Czech-copy claim is unfalsifiable; and (d) a set of named states that no fixture on this deployment can reach, each flagged at the ticket that built the screen. Ranked below by what would bite hardest in front of real students on a real course. Two structural facts frame the whole list: the e2e suite (257 tests, Chromium only) is deliberately not in CI because it needs a live core-api (DEC-045), and P-002, P-003 and P-004 have all since been run — so the items below that name them describe what remains **after** those passes, not work nobody has started.

### 5.1 No screen in the evaluation half of the product has ever rendered a passing test

This dev machine is cgroup v2 only, so the vendored isolate 1.8.1 sandbox cannot run and every seeded submission resolves to an infrastructure `evaluation_failure` ("Isolate init error. Return value: 2"), confirmed via `docker logs recodex-worker-1`. The consequences are enumerated in the Current Status block, not hidden: S-015's test-by-test table, its compilation-output panel and its limit-exceeded badges "have never been seen with data"; the dashboard shows every one of alice.student's four submissions as "Not submitted" because core-api builds the best solution from _valid_ solutions only, so `status` is `null` (Q-012); S-013's teacher-side class summary has "only ever been rendered as zero" for fully-solved and "nothing has been scored yet" for average points. The failure path is the only one that has ever been exercised, and it was exercised well. This is not a regression -- the compose repo's own README already names macOS/Docker Desktop as a host where this shows up -- but it means the single most-used screen in ReCodEx is untested against its normal case.

**What would fix it.** Stand the stack up on a cgroup v1 host (a Linux box booted with `systemd.unified_cgroup_hierarchy=0`, per DEC-031's own diagnosis), run `pnpm seed`, then walk three accounts in order. (1) `alice.student@seed.recodex.local` / `RecodexSeed123!`: open the `[seed] correct` and `[seed] wrong` solutions of Intro to Programming's primary assignment -- the seed deliberately makes one logically right and one logically wrong -- and check that the test table, per-test measured values, limit ratios and judge logs render, that the correct one scores and the wrong one does not. (2) The same student's dashboard: the two assignments must stop saying "Not submitted". (3) `sam.supervisor@seed.recodex.local` (admin of Intro to Programming): the assignment screen's four tiles -- fully-solved count and average points must show non-zero for the first time. Compare each against the legacy app rendering the same solution ids.

**Why it matters.** Highest. Every student and every teacher hits these screens daily; a formatting or logic error in the passing branch would be invisible until the day of the first real assignment. It is also the largest single block of untested surface in the repo, and it is contiguous rather than scattered.

_Cited from:_ `DEC-031`, `Q-012`, `S-015 (PROGRESS.md:2741-2745)`, `S-013`, `S-001`, `PROGRESS.md:3708-3717 (Current Status, "Known environment limitation")`, `PROGRESS.md:1217-1224 (F-025 observations)`, `docs/SEED_ACCOUNTS.md:26,80-82`

### 5.2 Live evaluation progress: the pending state it exists for has never stayed open long enough to see

S-016 built two mechanisms on purpose (DEC-065, closing DEF-004): a direct WebSocket to the monitor when the channel id is available (it is disclosed exactly once, in the submit response, and no endpoint returns it later), and a five-second `router.refresh()` self-poll for every other way of arriving at the page. Both were verified in pieces -- the socket against a real job's channel (3 of 6 tasks counted, the bar red because the job genuinely failed), the poll by watching a server-rendered timestamp change twice in twelve seconds. What could not be reproduced is the state itself: on this host every evaluation fails in well under a second, and stopping the worker produces an immediate broker failure ("Worker ... dieded") rather than a queued job.

**What would fix it.** On the cgroup v1 host, submit a solution to an exercise with a deliberately slow test (a sleep, or a large input) so the pending window lasts tens of seconds. Watch three cases: (a) the socket path -- submit and stay on the page you are redirected to, which carries `?monitor=...&tasks=...`, and confirm tasks tick off one at a time and the bar goes green; (b) the replay path -- submit, then reload the page a few seconds later, and confirm the monitor's five-minute replay still fills the bar; (c) the poll path -- open `/solutions/:id` directly with no query string, and confirm the server-rendered result appears within five seconds of the job finishing, and that the polling stops when the tab is hidden and after five minutes. Also confirm the WebSocket URL: this app uses `MONITOR_WS_URL` from its own env, not the `monitorUrl` core-api returns, and on the production deployment the two must agree (and must be `wss://` once TLS lands).

**Why it matters.** High. This is the screen a student stares at for the thirty seconds after they submit, and the one that determines whether they submit again out of doubt. A stuck spinner, a bar that never completes, or a socket that never reconnects would be a support-ticket generator on day one.

_Cited from:_ `S-016 (PROGRESS.md:2830-2864)`, `DEC-065`, `DEF-004`, `Q-006`

### 5.3 Not one email has ever left this deployment; every mail-dependent flow was verified with a self-minted JWT

Q-007 records SMTP as unconfigured and the whole project proceeded on the `mail.debugMode` assumption (ASS-008). This deployment's SMTP host is `smtp.example.com`, which is why AD-001's resend-verification button renders core-api's own "Email cannot be sent, please try it later." Four flows were therefore driven by minting tokens with the instance's `JWT_SECRET` rather than by reading a message: A-004/A-005 password reset (run end to end on `seed.filler.25`, password changed and set back, token confirmed dead afterwards), A-006 email confirmation (driven on filler account 25, which is not undoable -- core-api has no un-verify endpoint), and S-024 invitation acceptance (a real invitation token minted locally, account created and then deleted). Three more were never observed at all: S-018's notification when a review is closed or edited (the `suppressNotification` checkbox is wired to core-api's flag but "no message was ever observed leaving"), T-019's notification to the author of a resolved submission failure, and T-005's bulk review-close, which mails every affected student. There is also a configuration trap here: core-api's `WebappLinks.php` builds the reset link as `%webapp.address%/forgotten-password/change?{token}`, and this app answers that old path only because `proxy.ts` forwards it -- if `webapp.address` still points at the legacy app after cutover, every reset link goes to the wrong frontend.

**What would fix it.** Configure real SMTP (or `mail.debugMode` with a readable `archivingDir`) on a staging instance and then read the actual messages for: forgotten password, email verification, group invitation, review closed, submission failure resolved. Check three things in each message -- the locale it was composed in, that the link's host and path resolve to this app (set core-api's `webapp.address` to the new frontend and confirm `/forgotten-password/change?<token>` still lands on `/[locale]/forgot-password/change`), and that the token still works after the redirect. Then re-run A-003's registration and A-006's resend button and confirm the buttons report success rather than core-api's send failure.

**Why it matters.** High. Password reset and invitation acceptance are how people who cannot get in get in; a broken link or a message in the wrong language is invisible to everyone except the person locked out. The bulk review-close mailing is the one that could go wrong at scale and irreversibly -- closing publishes comments and mails students, and reopening does not un-read them.

_Cited from:_ `Q-007`, `ASS-008`, `A-004 + A-005 (PROGRESS.md:298-306)`, `A-006 (PROGRESS.md:329-338)`, `S-024 (PROGRESS.md:3225-3235)`, `S-018 (PROGRESS.md:2827-2831)`, `T-019`, `T-005 (PROGRESS.md:63-65)`, `AD-001 (PROGRESS.md:746)`

### 5.4 The Czech half of the app has never been read by a Czech speaker

P-004 has been run — 176 corrections, including a domain noun that had been translated two ways — but **by a reviewer, not a native speaker**, which is the half that still needs a person. The only Czech that was demonstrably taken from the legacy app rather than composed here is F-013's set of page/sidebar titles, sourced from `repos/web-app/src/locales/{en,cs}.json` -- and that exercise immediately caught three cases a from-scratch guess would have got wrong: "Exercises" is `Úlohy`, not `Cvičení`; "Administration" is `Administrátor`, not `Administrace`; "Pipelines" is the singular `Pipeline`. Everything since then -- every deadline state, every error message, every confirmation dialog, every aria-label -- was written per-screen as the tickets landed (DEC-033: no bulk message port). The only automated guard is key parity: `lib/i18n-text/messages.test.ts`, added by T-005 after `Profile.groupSolutions` shipped rendering as its own key on the profile page, asserts both locales hold the same keys and that every literal key the source asks for exists. It says nothing about whether the Czech is right. There is precedent for English leaking through: D-003's DataTable chrome (pagination, select-all, empty text) was hardcoded English until S-004 became its first real caller, and "a Czech reader would have seen it here."

**What would fix it.** Have a Czech-speaking teacher and a Czech-speaking student each walk `/cs/...` end to end, not spot-check strings: dashboard, group, assignment, submit, solution, review; then group settings, exams, points matrix, assign-exercise. Ask specifically about (1) terminology against the legacy app's own `cs.json` -- the F-013 catches show the risk is real, not hypothetical; (2) the state words on the solution and dashboard rows; (3) the exam-lock wording, which S-008 deliberately reworded away from the legacy claim ("the group is the only one you can submit in", not "tied to this computer") and which therefore has no legacy Czech to copy; (4) `aria-label` / `title` / `sr-only` text, which the README explicitly counts as user-facing under the both-locales rule and which no visual review will surface.

**Why it matters.** High for a Czech university. Wrong terminology in the words that carry consequence -- odevzdáno/neodevzdáno, deadline states, points, the exam-lock copy, the refusal pages -- reads as an unfinished product to exactly the audience being migrated, and unlike a layout bug nobody on the build side can see it.

_Cited from:_ `P-004 (BACKLOG.md:183)`, `F-013 (PROGRESS.md:1362-1367)`, `DEC-033`, `T-005 (PROGRESS.md:68-71, lib/i18n-text/messages.test.ts)`, `S-004 (PROGRESS.md:2598-2602)`, `S-008 (PROGRESS.md:2983-2987)`, `P-005 (PROGRESS.md:3590-3592)`

### 5.5 The exam IP lock records this app's server, not the student -- verify it in a real exam room before relying on it

Locking a student into an exam pins them to the address the lock request came from (`GroupsPresenter::actionLockStudent` reads `getRemoteAddress()`), and core-api then refuses every later request from a different address (`BasePresenter::verifyUserIpLock`). In this app the lock request is made by the server, because the token never reaches the browser (brief §5), so the address recorded is the app container's -- identical for every student. Q-017 checked and found this is _not_ a BFF regression: core-api's Nette config in the api repo has no `http: proxy:` entry, so it trusts no proxy and the legacy frontend records the nginx container's address for every student too. The `groupLock` half -- confining the student to the exam group, which is what "secured mode" means in the UI -- does work, and S-008 words the screens accordingly ("address recorded", not "student's address"). Note also that a `GroupExam` record only comes into existence when the first student locks in, so a scheduled-but-unattended exam leaves no trace at all.

**What would fix it.** On the real deployment, schedule a throwaway exam in a test group, have two people lock in from two different machines, and open the lock-records table as a reader holding `viewExamLocks` after the exam ends. If both rows show the same address, the IP half is recording infrastructure and should either be disabled in policy or fixed by adding a trusted-proxy entry to core-api's `config.neon` (and deciding who is allowed to set the header). While there, confirm the phase transitions: leave the exam page open across the moment the exam begins and across the moment it ends, and check the page re-renders as the next phase instead of quietly lying.

**Why it matters.** High if anyone believes the IP lock is doing invigilation work. It is an operator decision, not a bug this repo can fix, and it is the kind of assumption that only fails on the day of a real exam.

_Cited from:_ `Q-017`, `S-008 (PROGRESS.md:2977-2987)`, `DEC-072`, `DEC-073`

### 5.6 Every performance and scale claim rests on 4 groups, 31 users and 28 assignments

The seed instance is: `[seed] Intro to Programming` (+ one subgroup), `[seed] Retired Course` (archived), `[seed] Large Lecture` (25 students, 25 assignments -- the pagination stress case), `[seed] Faculty of Seeded Studies` (organizational), plus 25 filler students. Against that, two known fetch shapes are unproven at real size. Q-015: `/v1/groups` returns every group the caller can see and S-004 fetches it whole and sorts/filters/paginates client-side, because core-api offers `search` but **no** server-side paging on that endpoint (checked); the question itself names "an instance with thousands of groups" as where this stops being right. And the dashboard fans out one `/v1/groups/{id}/assignments` per group for the deadline panel, on both the student and the teacher halves, because core-api has no assignment-collection endpoint (the same gap Q-011 records for search); Q-013 measured 27 requests for the seeded superadmin alone and calls the pattern "unbounded for a real teacher". T-020's exercise catalog is the one list that is searched server-side. The only performance number anywhere in the notes is S-012's 25-student group rendering in ~330 ms. P-003 is `todo`.

**What would fix it.** Restore a copy of the production database into a staging instance and open, timing TTFB and counting upstream requests in core-api's own log: (1) `/groups` as a superadmin -- this is the fetch-everything call; (2) `/dashboard` as a superadmin and as the teacher with the most groups -- this is the per-group fan-out; (3) `/groups/{id}?tab=students` for the largest real course, which renders both S-007's roster and T-006's points matrix from one `students/stats` response. If the group list is the problem, the fix Q-015 names is switching `DataTable` to a "caller narrows the query" mode over core-api's `search` -- a mode it does not have today.

**Why it matters.** High and quiet. A superadmin or a department-wide teacher on a production-sized instance is the first person to feel this, and the failure mode is a slow landing page rather than an error -- so it will be reported as "the new app is sluggish" rather than as a bug with a location.

_Cited from:_ `Q-015`, `Q-011`, `Q-013 (PROGRESS.md:2508-2512)`, `S-001 (PROGRESS.md:2426-2427)`, `S-003 (PROGRESS.md:2485-2486)`, `S-012 (PROGRESS.md:2925-2927)`, `T-001 (PROGRESS.md:3437-3439)`, `P-003 (BACKLOG.md:182)`, `docs/SEED_ACCOUNTS.md:38-44,71-74`

### 5.7 The markdown compatibility check used 16 hand-written constructs, not the real exercise texts brief §7 asked for

D-010 rendered 16 constructs through the legacy renderer (`markdown-it` at its defaults + `@iktakahiro/markdown-it-katex`, matching the legacy widget's own configuration) and through the candidate remark/rehype pipeline, and **10 of 16 differed**. Two were fixed because they would damage authored content: raw HTML vanished entirely (legacy runs `html: false`, which escapes and _shows_ it; react-markdown without `rehype-raw` drops it -- `<kbd>Enter</kbd>` rendered as the bare word "Enter"), and `It costs $5 and $10` became garbled mathematics. Four differences are accepted and shipped as behaviour changes: GFM autolinks bare URLs, task lists render as checkboxes, footnotes work, `<del>` replaces `<s>`. The `$` fix was built from measured legacy rules (no whitespace immediately inside the delimiters; `$$` is display math only when it stands alone) and is pinned by unit tests. But the corpus was synthetic and lived in a scratch harness outside the repo -- Q-013's own instruction was "test with real exercise texts from DB".

**What would fix it.** Dump `localizedTexts` for every exercise and assignment from the production database, render each body through both pipelines (the legacy widget's exact config on one side, `components/markdown/markdown.tsx` on the other), and diff the output. Triage by construct, in this order: prose containing `$` (the highest-frequency false positive), raw HTML notes, footnote syntax, bare URLs, and anything using `$$` mid-sentence. `lib/markdown/legacy-compat.test.ts` is where a newly-found rule belongs.

**Why it matters.** Medium-high. Exercise assignments are the text students actually read, they are years of accumulated authoring, and a mis-rendered formula or a swallowed HTML note is a wrong-answer generator rather than a cosmetic bug.

_Cited from:_ `Q-013`, `DEC-055`, `D-010 (PROGRESS.md:2172-2200)`

### 5.8 Named UI states with no fixture on this deployment -- each one flagged by the ticket that built it

Five states are wired to real API flags and have never had data behind them. (1) S-017's `tooLarge` (a file past core-api's preview limit) and `malformedCharacters` (a non-UTF-8 file) notices -- no seeded solution is either. (2) T-009's configuration editor: the `data-linux` and `haskell` descriptor variants, and the rule that five environments (`arduino-gcc`, `data-linux`, `prolog`, `haskell`, `pyspark`) cannot share an exercise with another -- this deployment installs six ordinary environments, so all three are ported from the legacy tables and carried on faith (Q-020). (3) S-003's calendar renders second-deadline entries "in a distinct tone" and this is "not visually verified" -- exactly one seeded assignment sets `allowSecondDeadline` (F-029 created it) and the calendar branch was never exercised. (4) A-003's registration: the success path and the name-collision branch "cannot be exercised here at all" because `LOCAL_REGISTRATION_ENABLED=false` on this instance (Q-019). (5) S-004's "organizational" group badge, folded into F-029. The pattern is good practice -- each was found by building the screen and having nothing to render -- but it is a list of five places where the first real data is also the first test.

**What would fix it.** Produce each state deliberately on staging, the way S-017 produced its ZIP case. (1) Submit a file larger than core-api's preview limit and a file with a Latin-1 byte in it, and open `/solutions/:id/sources`. (2) Install an instance carrying `data-linux` and `haskell` and open `/exercises/[id]/edit-config` -- check the descriptor variants render and that adding a second environment to a `prolog`/`haskell`/`pyspark`/`arduino-gcc`/`data-linux` exercise is refused with a readable reason. (3) Give a real assignment a second deadline and look at the month grid and the mobile list. (4) Turn `ALLOW_LOCAL_REGISTRATION` on against an instance whose core-api also has `localRegistration.enabled` -- note Q-019: the flag has to be set in two places -- and register two people with the same first and last name to reach the collision branch. (5) Mark a real group organizational.

**Why it matters.** Medium. Each is narrow, but (1) and (2) are on the two screens that matter most to their audiences: a student reading their own submitted file, and a teacher trying to work out why core-api says their new exercise is broken.

_Cited from:_ `S-017 (PROGRESS.md:2792-2794)`, `T-009 / Q-020 (PROGRESS.md:3722-3726)`, `S-003 (PROGRESS.md:2588-2589)`, `F-029`, `A-003 / Q-019 (PROGRESS.md:384-387)`, `S-004 (PROGRESS.md:2611-2613)`

### 5.9 External sign-in (CAS) has never been exercised against a real identity provider

Q-004 verified against the deployment's `.env` that CAS is not configured -- no `EXTERNAL_AUTH_*` variables at all -- and instructed that the callback and the registration UI be built regardless, treated as "implemented but unreachable/disabled by current config, not done-and-tested". The callback Route Handler has existed since F-016/F-020 and is used by the e2e suite for its session helper; A-007 then found that the app had "a callback but no way to start it" and shipped the entry point. So the round trip -- redirect to the university's CAS, ticket back, session established, first-time user provisioned -- has never happened once.

**What would fix it.** Point a staging deployment at the faculty CAS (`EXTERNAL_AUTH_URL`, `_SERVICE_ID` and friends, the same variables the legacy frontend reads) and test four cases with real accounts: an existing ReCodEx user signing in; a CAS user with no ReCodEx account (does it provision, or refuse readably?); a cancelled/failed CAS round trip; and a return to a deep link, since `?from=` is guarded by `safeRedirectTarget` and anything that is not a single-slash path on this app becomes the dashboard. Also confirm the session cookie the callback sets carries the same httpOnly properties F-024's security spec asserts for the password path.

**Why it matters.** High on the day of cutover, low until then. At a Czech university this is likely to be _the_ way most people sign in; if it is broken, nobody gets in at all, and it is the one flow that cannot be smoke-tested from this repo.

_Cited from:_ `Q-004`, `A-007`, `F-016`, `F-020`, `DEC-099 (safeRedirectTarget)`, `F-024`

### 5.10 Two security-shaped things that are not regressions but are worth a decision before real students arrive

Q-018: `/accept-invitation` renders the invited person's name, email and dates straight out of the JWT in the URL without verifying the signature, because it _cannot_ -- core-api signs with `accessManager.verificationKey`, which this app deliberately does not hold (DEC-085), and there is no endpoint that will validate an invitation token, checked against the whole of `openapi/core-api.yaml`. Nothing is granted on the strength of what the page shows (the real `POST /v1/users/accept-invitation` rejects a forged token with `400-000`), and the legacy frontend has the identical exposure. What it costs is that anyone can craft a link on this deployment's own domain showing an arbitrary name and email above a password field, and it _is_ the legitimate page. Q-016: a refused page renders correctly and answers **HTTP 200** -- measured with a probe route whose entire body was `forbidden()`, so it is the `(app)` shell streaming its first bytes before any page body runs, not a late call. DEC-034 chose `experimental.authInterrupts` specifically to get a real 403, and for routes inside the authenticated shell that turned out to be half true. F-030 fixed the half a reader can see; the status line is unchanged.

**What would fix it.** Q-018: mint a JWT with a bogus key carrying an arbitrary name and email, open `/accept-invitation?<token>`, and see for yourself what a recipient would see; then decide whether to ask core-api for the validation endpoint. Q-016: `curl -i` a permission-gated URL with a student's session cookie -- S-013's `/assignments/{assignmentId}/users/{someoneElsesUserId}` is the first such route, and every teacher screen from T-002 onwards inherits it -- and confirm the status line before wiring uptime checks or a WAF against these paths.

**Why it matters.** Medium. Q-018 is a phishing surface on a university domain and an easy ask of the core-api team (one validation endpoint, same shape as `users/validate-registration-data`). Q-016 matters to monitoring, crawlers, and any non-browser client -- a permission-gated URL that answers 200 will be indexed and will be reported as "up".

_Cited from:_ `Q-018`, `Q-016`, `DEC-085`, `DEC-034`, `DEC-070 / F-030`, `S-013`

### 5.11 Test coverage: Chromium only, not in CI, and the suite writes to the live instance

257 e2e tests and 170 unit tests at the last recorded count. Three limits. (1) Chromium only, per DEC-045 -- no Firefox or WebKit run appears anywhere in the notes. (2) Deliberately **not** wired into `.github/workflows/ci.yml`, because the tests need a real reachable core-api and GitHub Actions has neither one nor a way to stand one up from this repo alone; CI runs `typecheck`, `lint`, `build` and the unit tests only. So the suite protects against regressions exactly as often as a developer remembers to run `pnpm test:e2e` against their own stack. (3) The suite mutates the instance: S-014's spec uploads a real file through the real chunked path and creates a genuine solution every run, and its own note says "on this box they fail evaluation and so do not consume an attempt, which would not hold on a working host". S-008's exam test runs against a separate group and cancels any exam a previous failed run left behind, because group-wide state is what two Playwright workers can genuinely fight over. The seed has its own history here: re-running it four times accumulated eight reference solutions before anyone looked (F-029), and the existing extras were left in place because deleting instance data is an operator's call.

**What would fix it.** Before cutover: run the full suite once on WebKit and once on Firefox and triage what breaks (the app leans on `useSyncExternalStore`, streaming RSC and `crypto.subtle`, which D-005 already found absent on plain-HTTP hostnames). Stand up a CI job with a core-api service container so `pnpm test:e2e` runs on every PR. And make a rule about the target: never point `pnpm seed` or `pnpm test:e2e` at production -- on a host with a working sandbox, the submit spec will start consuming students' real attempt allowances against whatever assignment it picks.

**Why it matters.** Medium-high, structurally. The gap is not that tests are missing -- there are a lot of them -- but that the safety net is opt-in and single-browser, which is precisely how a green repo drifts.

_Cited from:_ `DEC-045`, `F-023 (PROGRESS.md:1701-1704)`, `F-005 (PROGRESS.md:1163)`, `S-014 (PROGRESS.md:2722-2725)`, `S-008 (PROGRESS.md:2996-2999)`, `F-029 (PROGRESS.md:2689-2693)`, `D-005 (PROGRESS.md:1967-1972)`, `PROGRESS.md:990 (257 e2e / 170 unit)`

### 5.12 Accessibility was audited but never re-audited, and no assistive technology was ever used

P-002 has since been run and closed: 56 confirmed findings (14 serious, 8 refuted) applied across 103 files, and 45 routes given a title of their own. **What has not happened is a re-audit, and no assistive technology was used at any point** — every finding was contrast arithmetic and reading the accessibility tree out of the source. A screen-reader pass by a person is the thing that ticket could not do, and it is the check this section is asking for. Separately, real a11y defects were found by accident throughout, not by a check: S-018's only way to start a review comment was a double-click, "a gesture no keyboard can perform, on the screen where a teacher does most of their work"; T-002 put field hints inside `<label>` so a screen reader announced "Attempts allowed How many times one student may submit" as the field's name, and `components/users/account-forms.tsx` "still has the older shape; noted rather than swept in"; S-025 found `StatusState` hardcoding `<h2>` inside an `<h3>`-headed panel, which had been failing a spec intermittently at HEAD; A-008 found "Language" matching two different controls; F-028/A-001 found every `(anon)` page missing its `<main>` landmark, since F-001.

**What would fix it.** Re-run the P-002 audit against HEAD so there is a current list rather than a delta against an untracked one, and file it in BACKLOG.md. Then do the thing no automated pass does: one screen-reader session (NVDA or VoiceOver) over the three screens a student cannot avoid -- dashboard, assignment, submit -- and one over the teacher's review screen, which is the one with the known keyboard history. Check `components/users/account-forms.tsx` specifically, which is named as still carrying the label-hint defect. Add an automated axe run over the route list in `e2e/helpers/routes.ts` so the next regression is caught by a check rather than by a person.

**Why it matters.** Medium-high, and legally relevant for a public university. The pattern -- five real defects found as side effects of unrelated tickets -- says the ones nobody tripped over are still there.

_Cited from:_ `P-002 (BACKLOG.md:181)`, `PROGRESS.md:3660-3662 (Current Status)`, `S-018 (PROGRESS.md:3255-3258)`, `T-002 (PROGRESS.md:3409-3414)`, `S-025 (PROGRESS.md:3266-3271)`, `A-008 (PROGRESS.md:346-351)`, `F-028 + A-001 (PROGRESS.md:3241-3243)`

### 5.13 Three core-api defects an administrator will hit, each with a workaround and none of them fixed

All three were found by this project's own specs running against the live API, and all three are core-api bugs rather than frontend ones. Q-021: deleting an account whose email address was deleted once before answers HTTP 500 with a raw Doctrine `UniqueConstraintViolationException` -- anonymisation appends one fixed `@deleted.recodex` suffix to a column whose unique index still covers soft-deleted rows. Reproduced straight against core-api with `curl`; the workaround is to rename the account before deleting it, and AD-001's spec now mints a per-run address. Q-022: a licence's `isValid` flag can be switched on and never off, because the presenter tests the posted value for truthiness and reads `isValid: false` as "not provided". A revoke button was built on the strength of the published field and _deleted_ when the spec caught it doing nothing -- which is also the explanation for the legacy app's read-only column. Q-023: deleting an instance leaves its root group behind, orphaned and still listed; this is how eight stray groups had got into the superadmin's sidebar without anyone noticing, and AD-004's confirmation dialog now says so instead of promising a cascade that does not happen.

**What would fix it.** Reproduce each with `curl` on a staging instance to confirm they are still live in the core-api version being deployed: (1) create a user, delete them, re-create with the same address, delete again -- expect 500; (2) `POST` a licence with `isValid: false` and read it back -- expect it unchanged; (3) create an instance, note its root group id, delete the instance, then list groups -- expect the root group still there. Then decide whether they are core-api tickets. Separately, clean up: the eight orphaned groups already in the superadmin's sidebar on this deployment need deleting where groups are deleted.

**Why it matters.** Medium. Each is rare and each has a workaround, so nothing is blocked -- but Q-021 shows an administrator a PHP class name, which is the kind of thing that gets screenshotted, and Q-023 has already quietly polluted this instance's data.

_Cited from:_ `Q-021`, `Q-022`, `Q-023`, `AD-001 (PROGRESS.md:738-745)`, `AD-004 + AD-005 + AD-008`, `AD-006`, `PROGRESS.md:3689-3707 (Current Status, operator inputs)`

### 5.14 Two workflow facts that will surprise the first administrator, and one dead end the first visitor will find

(a) Signing in as somebody else is a one-way door. `actionTakeOver` calls the same `sendAccessTokenResponse` that login does -- an ordinary master+refresh token for the target, carrying nothing that says whose doing it was, read directly from core-api rather than inferred -- so there is no impersonation banner this app could honestly render and no token to swap back. It lands with a full page load rather than `router.push`, because the session cookie now identifies a different person while Next's client Router Cache still holds RSC payloads rendered for the administrator. A "return to my account" was considered and deliberately not built (DEC-112). (b) `/faq` is the last `PlaceholderPage` in the product and it is linked from the landing page A-001 shipped (`app/[locale]/(anon)/page.tsx:57-62`), kept public by `proxy.ts:34` and registered in the breadcrumb manifest -- so the one page a visitor is invited to open says "This page hasn't been built yet." (G-024). (c) T-002's exercise re-sync is "verified by hand, not by the spec", because making an assignment drift means editing the exercise it came from and no screen could do that until T-008; the manual run changed an exercise's text, watched the notice name `localizedTexts` as stale, synced it, and put both back.

**What would fix it.** (a) Brief the administrators, and have one of them do a takeover on staging: confirm the sidebar's Administration section disappears, `/users` refuses, and the only way back is sign out and sign in again -- and check the Czech of the confirmation dialog, which is where the honesty lives. (b) Open `/` as a signed-out visitor and click the second call-to-action; either build G-024 or remove the link before cutover. (c) Re-run the re-sync by hand once more on staging now that T-008 exists: edit an exercise's text, open an assignment made from it, confirm the notice names the stale part, press re-sync, confirm the text changed.

**Why it matters.** Medium. (b) is the single most visible defect to a person who has never used ReCodEx and takes one ticket to fix. (a) is a training issue, not a bug, but an administrator who takes over an account expecting a preview will lose their session without warning.

_Cited from:_ `AD-003 (PROGRESS.md:806-828)`, `DEC-112`, `G-024 (BACKLOG.md:222)`, `P-001 (PROGRESS.md:3509-3512)`, `A-001`, `T-002 (PROGRESS.md:3420-3424)`

### 5.15 The points export is a CSV shaped for one particular Excel, and it has never been opened in the faculty's

T-007 serves the points matrix as a Route Handler (so the link needs no JavaScript, can be bookmarked or curl'd, and re-reads from core-api at download time so core-api re-checks the reader). The file is semicolon-separated with a UTF-8 BOM, "which is what the legacy 'Excel export' actually is: the deployment's Excel splits on `;`, and the BOM is the difference between `Jiří Novák` and mojibake." It is CSV only -- a real `.xlsx` was rejected as a new dependency for a capability legacy never had. Shadow assignments appear as columns here even though the on-screen matrix has none, because their points are inside every row total and a file whose columns do not add up to its own total is one somebody will spend an afternoon disbelieving. One legacy bug was deliberately not reproduced: legacy's `escapeString` backslash-escapes an embedded quote where RFC 4180 doubles it, so a student named `O"Brien` breaks the legacy file and not this one -- unit-tested, along with the filename sanitiser that guards the `Content-Disposition` header.

**What would fix it.** As a teacher of a real course, download the matrix in `cs` and open it in the version of Excel the faculty actually uses -- check the columns split, that diacritics are intact, and that the shadow-assignment columns sum to the total column. Then download it as a reader who may _not_ see student emails and confirm the email column is empty rather than absent (T-007 verified this once on the seed). Also confirm the locale rides in the query string correctly: `/api/...` has no locale segment for next-intl to read, and an unknown locale is supposed to fall back rather than fail.

**Why it matters.** Medium. Teachers export points at the end of term and paste them into another system; a mojibake'd Czech surname column or a file that lands in one cell is a wasted afternoon at exactly the busiest moment.

_Cited from:_ `T-007 (PROGRESS.md:75-102)`, `DEC-095`, `DEC-079`

### 5.16 Nothing about the cutover exists in code, and the locale prefix breaks every old link

P-006 rewrote `docs/ROUTES.md` against `next build`'s own route listing rather than against the recon plan -- the plan had promised `/groups/[id]/info`, `/reference-solutions/[id]`, `/admin/server` and `/[...not-found]`, and "none of those four exist". More importantly it "had missed the change that actually breaks every old link": `localePrefix: "always"`, so every legacy URL anybody has bookmarked, mailed or pasted into a syllabus now needs a locale segment. ROUTES.md carries a redirect table and "says plainly that none of it exists in code yet". P-005 separates deployment from cutover for the same reason: nginx serves the legacy app at `/` today, and the redirect work, the core-api frontend-URL setting and the question of whether the old app stays reachable are all operator decisions (R-004). Note that this interacts with item 3 above -- core-api's `%webapp.address%` is what mail links are built from.

**What would fix it.** Read `docs/ROUTES.md`'s redirect table and implement it as nginx rules (or Next redirects) _before_ switching `/`. Test with real URLs pulled from the legacy access log, not from the table -- pick the twenty most-requested legacy paths and confirm each lands on the right new page with a locale prefix. Decide three operator questions explicitly: whether the legacy app stays reachable at a second hostname during a transition, what `webapp.address` is set to in core-api (it determines every emailed link), and whether `URL_PATH_PREFIX` is needed -- it is resolved at **build** time by Next, so it cannot be changed by an env var at run time the way the legacy app allowed.

**Why it matters.** Medium now, high on cutover day. Every link in every course page, every mail archive and every student's bookmarks points at the legacy shape.

_Cited from:_ `P-006 (PROGRESS.md:3531-3536)`, `docs/ROUTES.md`, `P-005 (PROGRESS.md:3579-3584)`, `R-004`, `DROPPED.md (URL_PATH_PREFIX as a runtime setting)`, `F-007 / F-003`

---

## 6. What to build next

Ranking this queue is easier than it looks, because P-001 already did the hard part: it walked all 138 INVENTORY.md rows against the code, found 65 wrong status cells, and returned not a list but a shape — this app reads well and writes badly, with fourteen of its twenty-nine gaps being a single control over an endpoint lib/api/core-api.generated.ts already types and no code calls (PROGRESS.md:3492-3500). That shape does most of the ranking work. Three tiers fall out. First, capabilities nobody can reach at all and for which no workaround exists — G-008 (a course cannot be started in this app), G-001/G-002 (a teacher cannot correct or re-run a grade), G-003 (a student cannot request the review whose teacher-side queue S-002 already built), G-009 (shadow assignments exist only because seed.ts creates them by raw API call). Second, one whole screen that was promised and quietly lost, G-005, the single brief §7 landmine that was stepped on. Third, everything with a workaround, ranked by how much the workaround costs. Cutting across all three is a scheduling insight worth more than any single ticket: the five cheapest items in the queue — G-003, G-016, G-020, G-029, and the exitCode half of G-004 — are each a small amount of work sitting on infrastructure that is already built, tested and in two cases verified live, and each one makes an already-shipped feature stop being decorative. And the Phase 8 question answers itself on a dependency, not a principle: X-001 imports courses fleeing GitHub Classroom into an app where a group cannot be created, so G-008 comes first or the importer's whole migration story ends at a screen that does not exist.

### 6.1 Rank 1 — G-008, creating a group. Nothing else in the G block blocks as much.

P-001's own ordering puts this first and the reason is categorical rather than comparative: a course cannot be started in this app at all. The hierarchy can be read, renamed, moved, archived and deleted and never extended — `grep -rn createGroup lib components app` finds only `createGroupInvitation`. The endpoint is `POST /v1/groups` (`parentGroupId`, `instanceId`, `localizedTexts`, `noAdmin`), already typed in `lib/api/core-api.generated.ts` and called by nothing. Two entry points, both copied from legacy: a subgroup control on a group's own screen gated on the `addSubgroup` hint, and a create control on `/groups`. DEC-093's create-first-configure-second shape applies directly — create with defaults, land on S-009's settings tab, rather than a wizard — so the design question is already answered and this is execution, not deliberation. It is also the single hardest dependency in the repo: every teacher screen built in Phase 5 (T-001 assigning, T-002 settings, T-003 solutions, T-006 the points matrix, T-007 the export) operates on a group that this app cannot bring into existence, and the seed script is currently the only way one appears.

**What would fix it.** Two controls over `POST /v1/groups`, gated on `addSubgroup` and the list-level create hint, landing on S-009's existing settings tab. Already `BACKLOG.md`'s Current Focus, so no re-planning needed — just do it before anything else.

**Why it matters.** Highest. This is the difference between "the app has gaps" and "the app cannot be adopted". A teacher who installs this and tries to use it for a new term stops at step one.

_Cited from:_ `BACKLOG.md:206 (G-008)`, `BACKLOG.md:292-296 (Current Focus = G-008)`, `PROGRESS.md:3502-3506 (P-001: "A group cannot be created (G-008), so a course cannot be started here at all")`, `PROGRESS.md:3654-3656 ("Next ticket: G-008")`, `DEC-093`, `DECISIONS.md:118`

### 6.2 Rank 2 — G-003, the student's review request. The cheapest gap in the list, and it turns an already-built screen from decorative into functional.

S-002 built the teacher's dashboard queue of "reviews students have asked for" in August, complete with seeded fixtures, batched author resolution and a 403-as-empty-queue rule. Nothing in this app can put a solution into that queue. `reviewRequested` is read in four places (`lib/api/assignment.ts:175`, `lib/api/assignment-solvers.ts:89`, `lib/api/dashboard.ts:384`) and written in none. The work is `POST /v1/assignment-solutions/{id}/set-flag/reviewRequest` and its cancel, on the solution screen and its sources page, offered on `setFlagAsStudent`/`setFlag` while no review is open. P-001 called this "the sharpest instance" of the whole read/write pattern. It ranks above the larger grading gaps because the ratio is extreme: two endpoint calls against a consumer that already exists, already has seed data, and already has tests.

**What would fix it.** One flag call and its cancel, on `/solutions/[id]` and `/solutions/[id]/sources`. S-002's seed fixtures already prove the state is reachable — the seed sets it by raw API call today.

**Why it matters.** High, and disproportionate to its size. Right now S-002's panel is a permanently empty box on every teacher's dashboard — worse than absent, because it implies a workflow the product does not have.

_Cited from:_ `BACKLOG.md:209 (G-003)`, `PROGRESS.md:3496-3500 (P-001: "S-002 built the teacher's queue of requested reviews, the field is read in four places, and nothing in this app can set it")`, `PROGRESS.md:2475-2493 (S-002, incl. the seed fixture that sets `set-flag/reviewRequest` by hand)`, `INVENTORY.md (`app/…/solution/:solutionId` = partial (G-001..G-004))`

### 6.3 Rank 3 — G-001 and G-002 together: the teacher's grading loop. Build them as one unit, not two tickets.

G-001 is the verdict — accept-as-final and its revoke via `POST /v1/assignment-solutions/{id}/set-flag/accepted` on the `setFlag` hint, and the points override via `POST /v1/assignment-solutions/{id}/bonus-points` (zero, full, clear, or an explicit override plus bonus, capped at the assignment maximum before the relevant deadline as legacy does). The accepted badge is already rendered everywhere in this app and nothing can set it. G-002 is the recovery — `POST /v1/assignment-solutions/{id}/resubmit` and its debug variant, `POST /v1/exercise-assignments/{id}/resubmit-all` on the assignment's solutions list, and `DELETE /v1/assignment-solutions/{id}` in the row menu, all gated on `resubmitSubmissions`, plus legacy's refusal notice when the solution's environment is no longer enabled on the assignment. They belong together because they are the two halves of one situation: the pipeline scored something wrong, and a teacher either overrides the number (G-001) or fixes the test and re-runs (G-002). Shipping one without the other leaves a teacher able to see a bad grade and able to do exactly one thing about it. G-002 is explicitly "the only way to re-grade work after fixing a broken test or limit", and G-001 is a capability the public landing page A-001 shipped actively advertises.

**What would fix it.** Two controls on `/solutions/[id]` and two on `/assignments/[id]/solutions`. Note the verification hazard below: neither can be end-to-end verified on this deployment, so the specs must be written against the request, not the resulting score.

**Why it matters.** High. This is the product's core promise to a teacher, and it currently ends at read-only. Both endpoints are typed in `core-api.generated.ts` and called by nothing.

_Cited from:_ `BACKLOG.md:207 (G-001)`, `BACKLOG.md:208 (G-002)`, `PROGRESS.md:3492-3496 (P-001: fourteen gaps are one button over an already-typed endpoint; names `set-flag/{flag}`, `/bonus-points`, `/resubmit`)`, `PROGRESS.md:3506-3507 ("a teacher cannot override the points a solution scored (G-001), which the landing page A-001 shipped happens to advertise")`, `INVENTORY.md (`app/…/assignment/:assignmentId/solutions` = partial (G-002, G-006))`

### 6.4 Rank 4 — G-009, shadow-assignment CRUD. The seed script is currently the user interface.

S-020 and T-024 shipped reading a shadow assignment and its points lifecycle; the entity's own create/edit/delete never shipped. `scripts/seed.ts` has to create them by raw API call "because no screen can" — that sentence is the whole argument. The work is `/shadow-assignments/[shadowId]/edit` over `POST /v1/shadow-assignments/{id}` (per-locale name/text/link, `maxPoints`, the informative deadline, `isBonus`, `isPublic`, carrying `version` for the optimistic lock the way T-002 already does), a delete on the `remove` hint, and a "New shadow assignment" button in the group's shadow section. It ranks here rather than lower because it is one of only three gaps P-001 classified as "things a person simply cannot do", and because it has a second consumer waiting: P-006's redirect table has a row with nowhere to point until the shadow-assignment editor route exists.

**What would fix it.** One editor route modelled on T-002's optimistic-lock form, one delete, one create button. T-002 is the template for `version` handling.

**Why it matters.** High for the courses that use shadow assignments (points awarded outside ReCodEx — attendance, oral exams), zero for those that do not. Worth knowing which the operator has before scheduling it above G-001/G-002.

_Cited from:_ `BACKLOG.md:211 (G-009)`, `PROGRESS.md:3504-3506 (P-001: "a shadow assignment cannot be created or edited (G-009), which is why scripts/seed.ts makes them by raw API call")`, `PROGRESS.md:3552-3553 (P-006: "Two rows have nowhere to point: the solution diff (G-005) and the shadow-assignment editor (G-009)")`, `T-024`, `S-020`, `T-002`

### 6.5 Rank 5 — G-024, the FAQ page. Not important, but it is the one broken thing a stranger sees first.

This is the last `PlaceholderPage` in the product and it is linked from the public landing page A-001 shipped (`app/[locale]/(anon)/page.tsx:57-62`), kept public by `proxy.ts:34`, and registered in the breadcrumb manifest. A visitor arriving at the front door is actively sent, by the page's second call-to-action, to a screen that says "This page hasn't been built yet." Legacy fetches an operator-configured markdown document (`FAQ_URI`, per-locale, defaulting to the project wiki) and renders it with a "content could not be loaded" callout. The implementation is a server-side fetch through the existing `components/markdown/markdown.tsx`. I rank it above every remaining teacher control because of who is exposed to it: the G-tickets below cost an authenticated professional a workaround, this one costs the project its first impression, and it is a few hours of work.

**What would fix it.** Server-side fetch of `FAQ_URI` rendered through the existing server `Markdown` component, with legacy's failure callout. The stated alternative is honest and also acceptable: drop it in `DROPPED.md` **and** remove the landing page's call-to-action that points at it. What is not acceptable is leaving the link pointing at the placeholder.

**Why it matters.** Low functionally, high reputationally. P-001 singled it out for exactly this reason.

_Cited from:_ `BACKLOG.md:222 (G-024)`, `PROGRESS.md:3515-3519 (P-001: "the last PlaceholderPage in the product is linked from the front page")`, `app/[locale]/(anon)/page.tsx:57-62`, `proxy.ts:34`, `A-001`, `INVENTORY.md (`faq` = todo (G-024))`

### 6.6 Rank 6 — the three one-liners: G-027, G-029, and the `exitCode` half of G-004. An afternoon, total.

G-027: `components/solutions/review-comment.tsx:188` renders a reviewer's comment body in a bare `<p>`, so emphasis, lists, links and fenced code snippets arrive as literal asterisks and backticks — legacy has a dedicated dialog for inserting a code fence, which tells you how often reviewers use them. The change is `<Markdown source={…} />`, and `lib/markdown/legacy-compat.ts:29-33` already escapes raw HTML so it adds no injection surface. G-029: the reference-solution cell in T-019's submission-failure table is inert text and should link to `/exercises/{exerciseId}/reference-solutions/{referenceSolutionId}` when `exerciseId` is set; the same ticket removes a now-stale sentence claiming otherwise from `BACKLOG.md`'s T-019 row and from `lib/api/submission-failures.ts:47`. The `exitCode`/`exitSignal` half of G-004: `components/solutions/evaluation-results.tsx` already fetches the value and throws it away, so a student whose program crashed is told only "Failed" — adding the per-environment name mapping is a display change, not a data change. These rank here because they are the highest quality-per-hour items in the entire backlog, and because two of them are cases of the app holding the right data and discarding it.

**What would fix it.** Three edits, each in one file. Do them in whatever gap opens between the larger tickets rather than scheduling them.

**Why it matters.** Individually cosmetic; collectively they are the difference between a review that reads like a code review and one that reads like a terminal dump, and between a student debugging a crash and a student guessing.

_Cited from:_ `BACKLOG.md:230 (G-027)`, `BACKLOG.md:234 (G-029)`, `BACKLOG.md:210 (G-004, the exitCode/exitSignal half)`, `components/solutions/review-comment.tsx:188`, `lib/markdown/legacy-compat.ts:29-33`, `lib/api/submission-failures.ts:47`, `T-019`

### 6.7 Rank 7 — G-005, the solution diff. The largest single build left, and the only gap that is a whole screen.

This is the one brief §7 landmine that was stepped on. Solution diffing is named in three `INVENTORY.md` rows, its Action Required column says "Keep capability", and nothing was built: no route, no component, no dependency. `DROPPED.md`'s Part 3 records it bluntly — `react-diff-viewer` was replaced by **Nothing**, and that row is in the library table precisely because "we replaced the library" quietly meant "we did not replace the capability". Legacy's behaviour is specific: pick a second solution, diff the paired files in two columns, swap sides, hand-map files whose names differ (remembered per pair), and hide reviews while in diff mode. The build reuses S-017's file loading and `lib/code/highlight.ts`'s tokens the way `reviewable-code.tsx` already does, at `?compare=` on the sources page or a `/diff/[otherId]` route. It ranks below the cheap items despite being the most conspicuous absence because it is the one item here that is genuinely a week rather than a day, and because a teacher comparing a student's successive attempts has an ugly but real fallback (open two tabs). It ranks above every remaining teacher control because it is a whole capability, not a control, and because P-006's redirect table also has a row waiting on it.

**What would fix it.** `?compare=` on the existing sources page is the cheaper of the two shapes and reuses more. Do not reach for a diff library before checking what S-017's loader and `lib/code/highlight.ts` already give you — the tokens are already there.

**Why it matters.** High, and the one item on this list that will be noticed as a regression rather than an omission by anyone who used the legacy app.

_Cited from:_ `BACKLOG.md:212 (G-005)`, `PROGRESS.md:3510-3515 (P-001: "Two brief §7 landmines were checked and one of them had been stepped on")`, `DROPPED.md Part 3, DROP-012 (`react-diff-viewer` → **Nothing**)`, `PROGRESS.md:3552-3553 (P-006 redirect row waiting on G-005)`, `INVENTORY.md (`/diff/:secondSolutionId` = todo (G-005))`, `S-017`

### 6.8 Rank 8 — G-013 and G-014, the reference solution's second half. Build them together; one of them is a lie in a doc comment.

T-011 built the reference-solutions screen — the answers that prove an exercise works, and without which core-api refuses to let it be assigned at all (DEC-097). What it did not build is reading them. The detail screen renders each file as a non-interactive `<span>` with a name and a size, **and its own doc comment claims the opposite**. So an author cannot read the solution that proves their own exercise works. G-013 is `/v1/reference-solutions/{id}/download-solution` for the archive plus the source viewer from `/solutions/[id]/sources` for reading one. G-014 is the same solution's earlier evaluations: each history row linking to its own submission via `?submission=` feeding `EvaluationResults`, deletion where `deleteEvaluation` allows, the debug variant of the resubmit the action already accepts, and the result archive per submission. G-014 is explicitly the same shape as G-004 on the student side and the note says the two "should be built to look alike" — which is a scheduling instruction: build G-004 and G-014 in the same sitting or they will diverge.

**What would fix it.** Reuse `/solutions/[id]/sources` for reading and `EvaluationResults` for the history. Pair G-004 and G-014 in one ticket window.

**Why it matters.** Medium-high for exercise authors, who are the smallest but most expert audience. The doc-comment falsehood is the part that should embarrass — it means a reader of the code was told the feature exists.

_Cited from:_ `BACKLOG.md:215 (G-013)`, `BACKLOG.md:216 (G-014)`, `BACKLOG.md:210 (G-004)`, `PROGRESS.md:507-534 (T-011)`, `DEC-097`, `INVENTORY.md (`referenceSolutionEvaluations`)`

### 6.9 Rank 9 — the teacher controls that have a workaround: G-006, G-007, G-010, G-018, G-011. Real gaps, but nobody is stuck.

G-006 — a Route Handler streaming `/v1/exercise-assignments/{id}/download-best-solutions`, gated on `viewAssignmentSolutions`, linked from T-003's screen; `app/api/solutions/[solutionId]/download/route.ts` is the template. This is how a teacher takes a class's work offline. G-007 — `POST /v1/exercise-assignments/{id}/localized-texts`, per-locale name/body/link carrying `version`; today an assignment's text is whatever its exercise says, changeable only by editing the exercise (which changes every assignment made from it) or re-syncing, and T-002's sync notice already reports exactly the divergence this screen exists to create deliberately. G-010 — the read side of the group/exercise relationship: attaching and detaching already exist (`lib/actions/exercise.ts:121,135`), so a teacher can put an exercise in a course's pool and cannot ask what is in it, and T-001's picker starts from the whole instance catalog instead. G-018 — `filters[authorsIds][]` plus legacy's one-click "Mine"; T-020 built the catalog's search and paging and left the author filter out, which on an instance with thousands of exercises removes the query an author actually makes. G-011 — legacy's one-click `mailto:?bcc=` over a group's students; partial rather than lost, because T-007's points export already carries the addresses. These rank together because they share a property: each has a documented workaround, and the workaround is annoying rather than blocking.

**What would fix it.** G-006 has a working template in the repo. G-007 is a form T-002 already demonstrates. G-010 is one query parameter (`filters[groupsIds][]=<groupId>`) defaulted on from `/groups/[groupId]/assign`.

**Why it matters.** Medium. Schedule them after the Tier-0 gaps but before any Phase 8 work; within the group, G-010 first because it also improves T-001's picker, then G-006, G-007, G-018, G-011.

_Cited from:_ `BACKLOG.md:214 (G-006)`, `BACKLOG.md:213 (G-007)`, `BACKLOG.md:224 (G-010)`, `BACKLOG.md:225 (G-018)`, `BACKLOG.md:231 (G-011)`, `lib/actions/exercise.ts:121,135`, `app/api/solutions/[solutionId]/download/route.ts`, `T-001`, `T-002`, `T-003`, `T-007`, `T-020`

### 6.10 Rank 10 — G-020 then G-023: the restricted-token pair. F-021 built the hard half and it has no caller.

The BFF half shipped as F-021 and was verified live in both `next dev` and a rebuilt Docker standalone container (DEC-043) — and `app/api/auth/restricted-token/route.ts` has no caller anywhere in the repo. G-020 is the form that was supposed to call it: a section on `/profile/edit` with scope (master / read-only / plagiarism / reference-solutions, plus group-external for a superadmin), an expiry, the refresh scope, and the returned token shown once with a copy control. DEC-043 returns the raw token in the response body by design for exactly this — it is the one intentional exception to DEC-021 in the whole auth module, and it currently exists to serve nobody. G-023 is the second consumer of the same endpoint: a superadmin narrowing their own effective role to see the app as a supervisor or a student, which legacy does by replacing the session with a restricted token. DEC-043 explicitly deferred it to "a future ticket" and the ticket was never filed, which is why it reads as an oversight rather than a decision — and why `DROPPED.md` refuses to list it as a drop. Order matters: G-020 first, because it exercises the route end to end and G-023 is then `effectiveRole` plus an `establishSession()` call on top of proven ground.

**What would fix it.** One `/profile/edit` section over an existing, live-verified route. Then G-023 as a superadmin-only control reusing the same response plus `establishSession()`, exactly as DEC-043 sketched.

**Why it matters.** Medium. G-020 is also the conservative answer to the third-party-extension question PEND-002/DEF-005 parks — a user minting a scoped token for themselves is what the legacy app itself does about external tools.

_Cited from:_ `BACKLOG.md:220 (G-020)`, `BACKLOG.md:228 (G-023)`, `DEC-043`, `DECISIONS.md:68`, `F-021`, `app/api/auth/restricted-token/route.ts`, `DROPPED.md, "Not in this table on purpose" (G-020 and G-023 are oversights, not drops)`, `PEND-002 / DEF-005`

### 6.11 Rank 11 — the pipeline trio, G-016, G-015, G-017. G-016 is a button on a function that already exists.

G-016: `lib/actions/pipeline.ts:130` `createPipeline()` **already exists and nothing calls it**. Forking an existing pipeline is the only current route to a new one, which fails outright on an instance that has none — so a fresh ReCodEx instance cannot get its first pipeline through this app. The work is one button on `/pipelines`, gated on the list-level create hint, landing on the T-016 editor. G-015: no screen lists, uploads, replaces, removes or downloads a pipeline's supplementary files — and the seeded pipelines reference one (`runner.py`), so a pipeline whose file needs replacing has to be fixed outside this app entirely. Model on `components/exercises/exercise-files.tsx` and reuse D-005's chunked upload Route Handler. G-017: export the structure the T-016 editor holds as JSON and import one back, so a definition can move between instances or be edited outside the app; legacy's undo/redo in the same component is deliberately not counted as part of this. These rank low because the audience is administrators and instance operators, who are few and who have shell access — but G-016 in particular is nearly free and closes an "empty instance is unusable" case.

**What would fix it.** G-016 is one button over an existing function — do it with the Rank 6 one-liners. G-015 and G-016 can share a sitting since both touch `/pipelines`.

**Why it matters.** Low-medium, except on a fresh instance, where G-016 is blocking.

_Cited from:_ `BACKLOG.md:218 (G-016)`, `BACKLOG.md:217 (G-015)`, `BACKLOG.md:219 (G-017)`, `lib/actions/pipeline.ts:130`, `components/exercises/exercise-files.tsx`, `D-005`, `T-016`

### 6.12 Rank 12 — the tail: G-021, G-028, G-025, G-019, G-026. Ranked last on impact, with one caveat that should move G-026 up if registration ever opens.

G-021 — signing out of every session: AD-002 built this for an administrator acting on somebody else, and the owner of an account cannot do it to themselves; it is `invalidateUserTokens(viewer.id)` followed by this app's own logout route, on `/profile/edit`, and it is the security action a person takes after losing a laptop. G-028 — a markdown preview: exercise texts, assignment texts and hints, group descriptions, system messages and pipeline descriptions are all authored in a bare `<textarea>`, and it matters most for exercise texts carrying KaTeX where a delimiter mistake is invisible until a student reads it; it is also the only thing left of the inventory row's promised "Code highlighting + CodeMirror 6 (editor)", so building or dropping it closes that row either way. G-025 — a QR code of the current page, named in both of `INVENTORY.md`'s final sections and in brief §7's "easy to miss" list, needing no API and no session, and it is how a lecturer puts the page they are showing onto the room's phones. G-019 — `POST /v1/exercises/{id}/notification`, which cannot be verified end to end here (no SMTP, Q-007), as is already true of the assignment publish notice and DEC-096's failure-resolve mail. **G-026 is the one to watch**: legacy's registration form requires an explicit GDPR consent tick before an account can be created, and the accept-invitation form creates an account too; A-003 did not carry it across. It is the one element of that form that exists for a legal reason rather than a functional one. It is harmless today only because local registration is disabled on this deployment (Q-004, `LOCAL_REGISTRATION_ENABLED=false`, A-003 ships closed and says so) — the day an operator turns registration on, this stops being rank 12 and becomes a compliance defect.

**What would fix it.** Build G-026 now anyway — it is cheap and the alternative (recording a decision that consent belongs elsewhere) requires someone with standing to make that call. G-028 pairs naturally with X-001, whose imported README becomes exercise text nobody can preview.

**Why it matters.** Low today. G-026 is a latent legal exposure whose severity is controlled by one environment variable the project does not own.

_Cited from:_ `BACKLOG.md:221 (G-021)`, `BACKLOG.md:232 (G-028)`, `BACKLOG.md:223 (G-025)`, `BACKLOG.md:226 (G-019)`, `BACKLOG.md:229 (G-026)`, `AD-002`, `A-003`, `Q-004 (QUESTIONS.md:44, CAS unconfigured and `LOCAL_REGISTRATION_ENABLED=false`)`, `Q-007`, `Q-019`, `DEC-096`, `DROPPED.md DROP-011`

### 6.13 Not features — G-022, G-012 and the G-023 decision: three tickets whose acceptable outcome is a paragraph in DROPPED.md.

Three of the twenty-nine gaps are phrased as "either build it or record the drop", and treating them as features overstates the work. G-022 (interface preferences over `POST /v1/users/{id}/ui-data`): two of legacy's seven keys still mean something in the new IA (`defaultPage`, `dateFormatOverride`); the other five — surnames first, open-on-double-click, sidebar folding, editor font size, Vim mode — are obsoleted by the redesign or moot while no in-browser code editor exists. Its note is explicit: build the two or record all seven item by item, "what is not acceptable is the current silence". `DROPPED.md`'s DROP-C03 is already flagged **provisional** and names G-022 as the ticket that decides it — the only provisional row in that file. G-012 (a group's external SIS attributes over `/v1/group-attributes/{groupId}`) is cosmetic on a deployment with no such system and is explicitly "worth a `DROPPED.md` line beside the SIS decision if it is not built, so it stops reading as an oversight". G-023, if not built, must promote DEC-043's dangling deferral into a proper drop. `DROPPED.md`'s own closing rule is the standard: a row needs the capability in a user's words, the legacy file that proves it existed, and a decision id — "a row without a decision id is a G-ticket wearing a disguise".

**What would fix it.** Batch all three into one writing session alongside P-008. Cost is hours; the payoff is that `INVENTORY.md` and `DROPPED.md` become jointly complete for the first time.

**Why it matters.** Low as work, high as hygiene. These three are the last places where the parity contract still says nothing rather than saying no, and P-001 exists because four months of that silence produced 65 wrong status cells.

_Cited from:_ `BACKLOG.md:227 (G-022)`, `BACKLOG.md:233 (G-012)`, `BACKLOG.md:228 (G-023)`, `DROPPED.md DROP-C03 (provisional, pending G-022)`, `DROPPED.md, "What would go in this file next"`, `DEC-043`, `P-001`, `P-007`

### 6.14 The rest of Phase 7 is now done, and it did not shrink the G block

P-001 through P-007 have all landed. What they changed is the accuracy of this project's own
records, not the size of its remaining work: the parity sweep corrected 65 of 138 inventory status
cells and filed 29 gaps; the accessibility pass applied 56 findings across 103 files; the
performance pass applied 15 and filed 5 with their measurements; the Czech review corrected 176
strings; and the README, the route map and `DROPPED.md` were rewritten against the code rather than
against the recon plan.

Three things follow for scheduling, and they are the reason this item stays in the list rather than
being struck from it.

**Every G-ticket built from here adds surface none of those passes has seen.** That is exactly the
trap that produced 65 stale inventory cells: a pass is a snapshot, and the code moves. A new screen
built for G-001 will not have been contrast-checked, will not have a `<title>`, and will not have
had its Czech read. The cheap discipline is to apply each pass's rules while building rather than
re-running the pass afterwards — the fixes are now all in the tree as examples to copy.

**P-004 is done but its dependency is not.** 176 corrections were made by a reviewer reading
carefully; none were made by a native speaker, which is what the ticket actually asked for and what
this project cannot supply from inside itself. Ask the ReCodEx team for one now rather than when the
queue next reaches i18n. The terminology table the review agreed on is the thing to hand them: it is
short, it is where the errors clustered, and a native speaker can check it in an hour.

**P-003 is done but three of its five filed items are worth more than most of the G block.**
PF-001 alone is 85% of one page's HTML. It did not get applied because narrowing the translation
catalogue turns a missed namespace into a runtime error on a single screen that neither `build` nor
`typecheck` can see — which makes it a careful morning's work, not a risky one, and it should be
scheduled as such rather than left to look like leftovers.

**What would fix it.** Schedule PF-001 alongside the top of the G block rather than behind it; ask
for a Czech reviewer now; and treat each pass's rules as build-time conventions from here rather
than as passes to repeat.

**Why it matters.** Medium, and rising with every G-ticket built. The specific risk is a second
round of stale records — this time in accessibility and copy rather than in `INVENTORY.md`.

_Cited from:_ `P-001`, `P-002`, `P-003`, `P-004`, `P-005`, `P-006`, `P-007`, `DEC-118`, `DEC-119`, `BACKLOG.md` (PF-001..PF-005)

### 6.15 The redirect layer is the only cutover-blocking item on this list, and nobody has scheduled it as work.

P-006 rewrote `docs/ROUTES.md` against `next build`'s own route listing and its finding is that **nothing redirects today**: `next.config.ts` has no `redirects()` and `proxy.ts` rewrites nothing but the locale. That is harmless right now only because nginx still serves the legacy app at `/` and this one answers on its own host port. It stops being harmless at cutover, and the table is more delicate than it looks: `localePrefix: "always"` means there is no `/dashboard`, only `/en/dashboard` and `/cs/dashboard`, so a redirect table that ignores locale sends every bookmark to a 404; six legacy group routes collapse into one route plus a `?tab=`, so those need query strings, not path rewrites, and must be ordered before the generic `/app/:path*` rule or it swallows them. Two open questions gate it: R-001 chose `redirects()` over nginx, but **R-004 is open and decides whether the `/app/:path*` catch-all is safe at all** — if both apps stay reachable during cutover, adding that rule makes the legacy app unreachable through its own URLs. And two rows of the table cannot be written until G-005 and G-009 ship, because a redirect to an unbuilt route is a 404 with an extra hop.

**What would fix it.** File it as a ticket. Answer R-004 with the operator before writing the table (it changes what the table contains, not just when). Sequence it after G-005 and G-009 so the two waiting rows can be filled in the same pass.

**Why it matters.** Zero today, blocking on cutover day. It is the one item here whose cost rises sharply if it is discovered late, and it is filed as prose in `ROUTES.md` rather than as a ticket in `BACKLOG.md`.

_Cited from:_ `PROGRESS.md:3530-3553 (P-006)`, `ROUTES.md:260-263 (R-001 answered, R-002 open, R-003 answered, R-004 open)`, `P-005 (README's deployment/cutover section)`, `BACKLOG.md:212 (G-005)`, `BACKLOG.md:211 (G-009)`

### 6.16 Do not schedule F-028. It is a calendar reminder that has been mistaken for a ticket, and the status docs disagree about it.

F-028 asks whether the TypeScript 7 / ESLint 10 pins can be lifted. Re-checked on 2026-09-02: `typescript-eslint@8.69.0`, latest and canary alike, still declares `typescript: >=4.8.4 <6.1.0`, so TS 7 is excluded outright; the ESLint half has moved — `typescript-eslint` now accepts `^10.0.0` and the only remaining blocker is `eslint-plugin-react@7.37.5`, **transitive** via `eslint-config-next`, peering at `eslint: ^9.7`, and whose `next` dist-tag (`7.8.0-rc.0`) is an _older_ release than latest. Nothing in this repo can lift either. The evaluation the ticket asks for has now been done twice; what it waits on is somebody else's release. Two smaller notes for whoever reads the docs next: `BACKLOG.md`'s Blocked table lists F-028, while `PROGRESS.md`'s Current Status says "**Blocked tickets:** None" — a direct contradiction between two files a reader would consult for the same question. And `AGENTS.md` has been updated to say to check `eslint-plugin-react` first next time, which is the right shape for this class of item: a note, not a queue entry.

**What would fix it.** Leave it blocked, re-check when either package ships support, and reconcile the two status lines.

**Why it matters.** None as work. The doc contradiction is minor but it is exactly the failure mode P-001 was created to fix, three weeks after P-001.

_Cited from:_ `BACKLOG.md:72 and BACKLOG.md:304 (F-028, blocked)`, `PROGRESS.md:954-963 (F-028 re-check, both pins stay)`, `PROGRESS.md:3688 ("Blocked tickets: None" — contradicts BACKLOG.md's Blocked table)`, `PROGRESS.md:3649-3652 ("F-028 was re-checked and stays open on purpose")`

### 6.17 The one thing that must come before any Phase 8 work: G-008. X-001 imports courses into an app that cannot hold a course.

`BACKLOG.md`'s Phase 8 gate reads "Nothing here starts before the parity sweep (P-001) has said what is actually finished." P-001 has now run, so the gate is formally satisfied — and its answer was that parity is _not_ met and 29 capabilities are missing. Reading the gate as discharged would be reading it as a scheduling formality rather than a condition. But there is a harder, non-rhetorical dependency, and it is G-008 specifically. X-001 exists because GitHub Classroom is being retired and the courses that used it need somewhere to go. Its output is a **draft exercise** plus a report of what could not be mapped. An exercise is only useful once it is assigned to a group — and a group cannot be created in this app (G-008), so a course migrating off Classroom would arrive at an importer that works and then stop dead at the screen that does not exist. The migration story X-001 sells is not completable without G-008, no matter how well the importer parses `autograding.json`. Two softer adjacencies, worth noting but not gating: X-001 lands an exercise that is deliberately **not assignable** because core-api refuses assignment without a reference solution (T-011, DEC-097) — so the author's follow-up path runs through the reference-solution screens whose read half is G-013; and the imported `README.md` becomes exercise text with KaTeX in it, authored in a bare `<textarea>` with no preview (G-028).

**What would fix it.** Ship G-008 (and ideally the Rank 2–4 write-half gaps) before X-001 starts. The good news is that X-001's own cost is contained: it needs **no API change** — everything an import does (create an exercise, write its texts, upload supplementary files, write the test configuration and the score config) is what T-008, T-009, T-023 and T-025 already do through existing endpoints, so an importer is a file parser plus calls those screens already make.

**Why it matters.** Decisive. If only one sentence survives from this section into the final document, it is that G-008 comes before X-001.

_Cited from:_ `BACKLOG.md:239-241 (Phase 8 gate: "Nothing here starts before the parity sweep (P-001) has said what is actually finished")`, `BACKLOG.md:245 (X-001, status `idea`)`, `BACKLOG.md:247-286 (X-001 write-up)`, `BACKLOG.md:206 (G-008)`, `T-011`, `DEC-097`, `T-008, T-009, T-023, T-025`, `BACKLOG.md:232 (G-028)`

### 6.18 X-001 itself, if it is built: the honest-failure shape is the design decision, and three open questions come first.

The write-up is unusually good and its conclusions should be carried into the final document rather than re-derived. What maps cleanly: Classroom's `autograding.json` describes tests as `{name, setup, run, input, output, comparison, timeout, points}`, and the `input`/`output` kind — feed this to stdin, expect that on stdout, compare `exact` or `included` — is exactly a ReCodEx test with the diff judge; the seeded `[seed] Echo Greeting` exercise is that shape. The template repo's `README.md` is the exercise text and its other files are supplementary files. For an intro programming course, which is most of the affected population, that covers the bulk of an assignment. What does not map, and the write-up insists must be _said_ rather than silently dropped: an arbitrary shell `run` line has no equivalent, because ReCodEx's pipelines are declarative (a compilation pipeline and an execution pipeline per environment), not "run this"; framework tests (pytest, JUnit) cannot become per-test stdin/stdout pairs and can only become **one** test judged on exit code, collapsing twenty cases into one pass/fail; per-test `points` map onto T-025's score configuration but Classroom's arithmetic and ReCodEx's are not the same; and **a reference solution cannot be imported**, so an import lands an exercise that is deliberately not assignable and the screen has to say why. Hence the shape: not one-click, but a draft exercise the author finishes plus a per-test report of what could not be mapped — "more honest than a wizard that appears to succeed and produces an exercise that grades nothing". Three questions are open before any of it: which Classroom export actually exists once the service is retired; whether to import a roster into a group as well, which needs email addresses Classroom may not carry; and whether the newer GitHub-Actions-based autograding is worth parsing at all, since it is arbitrary YAML running arbitrary steps.

**What would fix it.** Get the three open questions answered by the operator while the G block is being built — they cost the operator time, not this project's, and they can run in parallel.

**Why it matters.** This is the only item in the whole queue the operator asked for directly, which is why it will attract pressure to jump the line. The dependency argument above is the reason not to let it.

_Cited from:_ `BACKLOG.md:247-286 (X-001 write-up: Why / What maps / What does not / Shape / The good news / Open questions)`, `T-025`, `T-011`, ``[seed] Echo Greeting` fixture`, `PROGRESS.md:3663-3667 (X-001 filed and not started)`

### 6.19 Scheduling hazard that applies to the top of the ranking: the three highest-ranked write-half tickets cannot be verified on this deployment.

G-001, G-002 and G-004 all act on evaluation results, and this dev machine cannot produce real pass/fail evaluation results at all — Docker Desktop runs cgroup v2 only, so the worker's sandbox cannot run (DEC-031). Since S-015 this has stopped being a footnote: the solution screen's test table, compilation output and limit badges have **never been rendered with real data**, the dashboard reports every seeded submission as "Not submitted" (Q-012), S-016's pending progress state cannot be held open long enough to see because every evaluation here fails in under a second, and S-013's "fully solved" count has only ever rendered as zero. Every reference solution on this deployment reports an infrastructure failure (T-011). So a points override (G-001) can be verified as a request that succeeds and a number that changes, but not as a grade a student sees against a real score; a resubmit (G-002) can be verified as a call, not as a re-grade; and G-004's `exitCode` mapping has no non-zero exit code to render. This does not change the ranking — those tickets are still the most important — but it changes what "done" can mean for them, and it should be written into their specs rather than discovered at review.

**What would fix it.** Write the assertions against the request and the optimistic state, not the resulting score. Ask the ReCodEx team for one cgroup v1 host — a single re-verification pass over the accumulated list (S-013, S-015, S-016, T-011, G-001, G-002, G-004) is worth more than any single ticket in this ranking.

**Why it matters.** Medium and systemic. The project has been shipping evaluation-facing UI unverified for months and saying so honestly each time; the accumulated list of never-rendered-with-data surfaces is now long enough to be a cutover risk in its own right.

_Cited from:_ `DEC-031`, `PROGRESS.md:3709-3717 (Known environment limitation)`, `PROGRESS.md:1219 (cgroup v2 confirmed via `docker logs recodex-worker-1`)`, `Q-012 (QUESTIONS.md:65)`, `S-013, S-015, S-016`, `PROGRESS.md:534 (T-011: every reference solution reports an infrastructure failure)`

### 6.20 The ranking principle worth stating outright: the cheapest and most valuable work in this queue is finishing halves of things that already exist.

P-001's real finding was a shape, not a list — "this app reads well and writes badly" — and fourteen of the twenty-nine gaps are one button against an endpoint `lib/api/core-api.generated.ts` already types and no code calls (`assignment-solutions/{id}/set-flag/{flag}`, `/bonus-points`, `/resubmit`, `/download-best-solutions`, `shadow-assignments` POST/DELETE, `POST /v1/groups`). The same pattern shows up outside the G block: A-007 found that F-019 had built the external-sign-in callback and its failure state and **nothing ever sent anybody to the provider**, so the capability was unreachable rather than unconfigured; AD-007 found a capability with nowhere to reach it, because `create` on system messages is granted from `supervisor` up and `viewAll` is not. The diagnosis P-001 offers is that a ticket saying "the X screen" got read as "render X", and the actions on that screen went with the screen rather than being tickets of their own. That has a direct consequence for how the next block is scheduled: **G-003, G-016, G-020, G-029 and the `exitCode` half of G-004 are each a small amount of work sitting on top of infrastructure that is already built, tested and in some cases verified live** — S-002's queue, `createPipeline()`, F-021's route, T-019's table, `evaluation-results.tsx`'s discarded field. Doing those five first would close five inventory rows for roughly the cost of one ordinary ticket, and would make five already-shipped features stop being decorative.

**What would fix it.** Write the remaining G tickets as capabilities with verbs ("a teacher accepts a solution"), not as screens. And when a ticket ships a screen, file its actions explicitly rather than assuming they travelled with it.

**Why it matters.** This is the scheduling insight the ReCodEx team should take away. It is also the argument for not writing the next batch of tickets the way the last batch was written.

_Cited from:_ `PROGRESS.md:3492-3500 (P-001: the read/write shape, the fourteen uncalled endpoints, the "screen vs action" diagnosis)`, `PROGRESS.md:3481-3486 (P-001 header)`, `PROGRESS.md:981-983 (A-007: "nothing ever sent anybody to the provider")`, `PROGRESS.md:3682-3685 (AD-007: a capability with nowhere to reach it)`, `lib/actions/pipeline.ts:130`, `app/api/auth/restricted-token/route.ts`, `BACKLOG.md:191-204 (P-001's own framing of the G table)`

---
