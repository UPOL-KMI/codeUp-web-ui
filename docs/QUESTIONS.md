# ReCodEx New Frontend — Open Questions

**Status:** Draft
**Date:** 2026-05-11

---

## Operator Inputs Needed

| #     | Question                                       | Context                                                                                           | Assumption Made                                                                                                                                                                                                                                                                                        | Where Used                                    |
| ----- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| Q-001 | **API base URL of the running instance**       | Legacy uses `API_BASE` from `etc/env.json`. What is the actual URL for this deployment?           | **Resolved — was wrong, see Resolved section.**                                                                                                                                                                                                                                                        | `.env.local`, API client                      |
| Q-002 | **Path to local checkout of legacy `web-app`** | I found it at `repos/web-app`. Confirm.                                                           | Confirmed by directory listing                                                                                                                                                                                                                                                                         | Recon, source reference                       |
| Q-003 | **Docker compose repo structure**              | I see `docker-compose.yaml` and `services/` in root. Is this the correct compose repo?            | Confirmed — but this new app's own source must NOT live there too, see Resolved section (this was violated once already and has been corrected).                                                                                                                                                       | Compose service entry                         |
| Q-004 | **External auth (CAS) configuration**          | Is CAS enabled? What are `EXTERNAL_AUTH_URL`, `_SERVICE_ID`, etc.?                                | **Resolved — was wrong, see Resolved section.**                                                                                                                                                                                                                                                        | CAS callback Route Handler                    |
| Q-005 | **Port for new app**                           | What port should the new Next.js app bind to?                                                     | **Resolved — operator approved the F-004 proposal as-is (host port `WEB_NEXT_PORT`, direct-publish, no proxy routing). Container's internal `PORT` stayed `3000`; host mapping became `3001` because `3000` was already bound by something else on the host, discovered live at `docker compose up`.** | `docker-compose.yaml`, `.env`, `.env.example` |
| Q-006 | **WebSocket monitor endpoint**                 | Legacy uses `evaluationProgress` module. Is `monitor` service running? What is the WebSocket URL? | **Resolved — was wrong (assumed wss), see Resolved section.**                                                                                                                                                                                                                                          | Live evaluation progress                      |
| Q-007 | **SMTP configuration**                         | Is outbound SMTP configured? Legacy uses `mail.debugMode` / `archivingDir` for inspection.        | Assumed: not configured yet, use `mail.debugMode` for dev                                                                                                                                                                                                                                              | Registration, password reset flows            |
| Q-008 | **Instance ID for multi-instance**             | Legacy `auth` module stores `instanceId`. Is this deployment multi-instance?                      | Assumed: single instance, `instanceId` from first login response                                                                                                                                                                                                                                       | Auth BFF, login flow                          |

---

## Technical Questions

| #     | Question                               | Context                                                                                                                       | Assumption Made                                                           | Where Used                                       |
| ----- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------ |
| Q-009 | **Next.js 16.3 exact patch version**   | Brief says "newest patch of 16.3.x". What is the exact version available?                                                     | Check `npm view next version` before scaffolding                          | `package.json`, Dockerfile                       |
| Q-010 | **OpenAPI specification availability** | Does the running API expose an OpenAPI/Swagger spec?                                                                          | **Resolved — not served, see Resolved section.**                          | API client type generation                       |
| Q-011 | **File upload size limit**             | Brief mentions 512 MiB ceiling. Confirm nginx and PHP config in compose repo.                                                 | Assumed: 512 MiB from brief; verify in `services/api/`, `services/proxy/` | Upload Route Handler                             |
| Q-012 | **Extension token handoff mechanism**  | Legacy `SIS-ext-webapp` receives a token. How is this done?                                                                   | Investigate legacy source and API docs                                    | Extension integration                            |
| Q-013 | **Markdown rendering compatibility**   | Legacy uses `markdown-it` + `@iktakahiro/markdown-it-katex`. Will `react-markdown` + `rehype-katex` produce identical output? | Test with real exercise texts from DB                                     | Markdown renderer component                      |
| Q-014 | **Graphviz rendering approach**        | Legacy uses `viz.js` (WASM). Should we port it, use server-side Graphviz, or replace with JS layout?                          | Port `viz.js` initially via `next/dynamic`, evaluate alternatives later   | Pipeline structure editor                        |
| Q-015 | **Short session behavior**             | Legacy `SHORT_SESSION` config gates sensitive operations. How does re-authentication work under httpOnly cookies?             | Design: re-auth prompt → new cookie with short expiration                 | Sensitive operations (grade edit, user takeover) |
| Q-016 | **Notification system**                | Legacy has `notifications` module. Is it polling-based or WebSocket?                                                          | Investigate legacy source                                                 | Header notification bell                         |

---

## Resolved

| #     | Question                               | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q-001 | API base URL                           | Verified against the compose repo's `.env` directly (not guessed). Public: `http://recodex.local/api/v1` (`PROTOCOL` + `APP_DOMAIN` from `.env`, proxied by nginx under `/api/`). Internal (server-side, inside the compose network): `http://api:80/v1` — the `api` service's own hostname, no proxy hop. `localhost:4000` was never correct for this deployment and must not appear anywhere in the codebase.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Q-003 | Compose repo / new-app source location | The compose repo (`ReCOdex/`) is correctly identified, but F-001 initially scaffolded this app's `package.json`/`app/`/`docs/` directly into its root — a direct violation of the brief's "new, empty repository" instruction and of §1's explicit "do not vendor your frontend's source inside the compose repo". Caught before any real app code existed; moved to a proper sibling repo (`../recodex-web-next`, git-initialized) with no data loss. If a future session ever finds itself creating files inside `ReCOdex/` for anything other than the one compose-file diff in constraint 1, stop and re-read §1. **Superseded 2026-08-20, see DEC-052**: at the operator's explicit request, this repo's checkout location moved again, from that sibling directory to `ReCOdex/repos/web-next/` -- fetched by the compose repo's own `pull-repos.sh`, gitignored there, exactly like the upstream ReCodEx repos. This is **not** a regression of the original violation: this repo's own git history and remote (`git@github.com:jurja00/codeUp-web-ui.git`) remain fully separate; only the local filesystem checkout location changed, for deployment convenience (clone the compose repo, run one script, get everything). If a future session finds itself wondering whether this contradicts §1 -- it doesn't; see DEC-052 for the full reasoning. What still holds: never edit files under `ReCOdex/` other than the one compose-file diff in constraint 1. |
| Q-004 | CAS configuration                      | Verified against `.env`: **CAS is not configured in this deployment** — no `EXTERNAL_AUTH_*` variables are set, and `LOCAL_REGISTRATION_ENABLED=false` too (local registration is currently closed, not open). Build the CAS callback route and the registration UI regardless (feature parity, §3 constraint 3, and the legacy config supports both) — they just have nothing to point at in this environment right now. Treat both as "implemented but unreachable/disabled by current config," not as done-and-tested.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Q-006 | WebSocket monitor endpoint             | Verified: `monitor` service is running (`services/monitor/` in the compose repo) and is proxied at `/ws` by the nginx `proxy` service, upgrade headers already configured there. **Scheme is `ws://`, not `wss://`** — this deployment currently runs `PROTOCOL=http` / `MONITOR_PROTOCOL=ws` (no TLS yet). Read the scheme from the same env source as `API_BASE_PUBLIC` rather than hardcoding `wss://`; it will need to flip to `wss://` when this deployment eventually gets TLS, and the code should not need to change when that happens, only the env var.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Q-010 | OpenAPI spec availability              | Verified by requesting it directly: **not served.** `repos/api/docs/swagger.yaml` exists in the api repo's source tree, but the compose deployment's nginx only exposes the `www/` document root (`services/api/nginx-site.conf`) — `docs/` is outside it and returns 404. Either (a) ask the operator to add a static-file location for it in `services/api/nginx-site.conf` (a compose-file-adjacent change — goes through the constraint-1 diff/approval process), (b) read `repos/api/docs/swagger.yaml` directly from disk once at codegen time instead of fetching it over HTTP, or (c) hand-write types. (b) needs no compose change and is probably the pragmatic default.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## Q-011: No global assignment search endpoint (D-015)

`docs/IA.md` §3.4 specifies the command palette should jump to "Assignments (by name, within
groups)". core-api has no endpoint that supports this: there is no `/v1/assignments` collection at
all, and no `/search`. Verified against the generated OpenAPI paths and against the live instance;
`search` query parameters exist only on `/v1/users`, `/v1/exercises` and `/v1/groups`.

**Proceeding without it** (brief §3.2: do not invent endpoints). The palette searches groups,
exercises and users. Assignments remain reachable by navigating to their group, which is how the
legacy app reaches them too.

If assignment search is wanted later, the options are (a) core-api change -- out of scope for this
project by brief §3.1, (b) client-side search over the assignments of the groups the user is in,
which is bounded and probably acceptable for a student but not for an admin with hundreds of
groups, or (c) leave as is. Recorded here so a future session does not rediscover the gap and
assume it was an oversight.

## Q-012: A student's assignment status cannot distinguish "not submitted" from "every submission failed" (S-001)

`GET /v1/users/{id}/groups`' `stats` array reports, per assignment, the status of the student's
**best** solution -- and core-api builds that from _valid_ solutions only
(`AssignmentSolutions::findBestUserSolutionsForAssignments` → `findValidSolutionsForAssignments`).
A student whose every attempt hit an infrastructure failure therefore has no best solution, no
status (`null`), and no points, which is indistinguishable in this payload from a student who has
never opened the assignment.

This is visible right now on the seeded data: `alice.student` has four submitted solutions across
two assignments, every one of them an `evaluation_failure` (`Isolate init error`, the cgroup v2
limitation in `SEED_ACCOUNTS.md` / DEC-031), and the dashboard shows both assignments as **Not
submitted**. The legacy dashboard shows the same thing for the same reason -- it reads the same
field -- so this is not a regression, and on a cgroup v1 host it stops being visible at all.

**Proceeding with "not submitted"** as the label for a `null` status: the alternative is to claim
a failure the row cannot see, which would be wrong for the far more common case of a student who
genuinely has not started.

If it turns out to matter, `/v1/assignment-solvers?groupId=&userId=` returns per-assignment
attempt counts (`lastAttemptIndex`, `evaluationsCount`) and would separate the two cases at the
cost of one more request per group. Not done now: it buys a distinction that only exists on a
broken worker, and the assignment's own screen (S-012) has the real solution list anyway.

## Q-013: No "recent activity" feed for a teacher (S-002)

`docs/IA.md` §4.1 lists three things the teacher half of the dashboard should answer, and the
third is "Recent activity -- new submissions, comments". Two of the three are single endpoints
(`/v1/users/{id}/pending-reviews`, `/v1/users/{id}/review-requests`) and are built. The third has
no endpoint behind it: core-api exposes solutions per assignment or per student-in-a-group, never
"everything recent across the groups I teach", and comments are reachable only per solution
thread. Verified against the generated OpenAPI paths and core-api's own router.

Building it from what exists would mean one request per assignment across every taught group --
27 requests for the seeded superadmin alone, and unbounded for a real teacher -- on the landing
page, to produce a list most of whose rows would be discarded. **Not built.** The legacy dashboard
has no such feed either (it shows per-group assignment tables), so this is not a parity gap.

The two review queues already answer "what needs my attention", which is the part of the same
section with real urgency behind it. If an activity feed is wanted later, it needs either a
core-api endpoint (out of scope by brief §3.1) or a deliberate, bounded approximation -- e.g. the
most recent solutions of one selected group -- which belongs to that group's own screen (S-006),
not to the dashboard.

## Q-014: `userCalendars` is an iCal token manager, not a calendar view (S-003)

`docs/BACKLOG.md` mapped S-003 ("Dashboard — calendar view") to the legacy `userCalendars` module.
Those are two different capabilities, and the mapping hid one of them:

- **The legacy `userCalendars` module** manages **iCal subscription tokens**
  (`components/Users/CalendarTokens`, rendered on the **EditUser** page, backed by
  `/v1/users/{id}/calendar-tokens` and `DELETE /v1/users/ical/{id}`). It creates a read-only feed
  URL that "will export deadline events for all assignments in all groups related to you" — its
  own words — for the reader's own calendar app. The legacy app has **no in-app calendar view at
  all**.
- **S-003's calendar** is a new-design addition (`docs/IA.md` §2, `?tab=calendar`), not a port.

Both are now accounted for: S-003 built the month view, and the token manager is recorded against
**S-022** (user settings), which is where legacy renders it. Feature parity is not at risk — but it
would have been, silently, if S-003 had been marked done as "the `userCalendars` row".

Worth noting the two are the same dataset by construction: the calendar view shows deadlines from
every group the reader studies in or teaches, which is exactly what the iCal feed exports. If they
ever disagree, one of them is wrong.

**Closed by S-022.** The token manager ships on `/profile/edit`: the tokens are listed with their
state, one can be created, and expiring is offered as the only revocation core-api has. Verified
end to end -- a created link was fetched directly and returned a real `VCALENDAR` feed, and the
same URL answered 400 once expired.

## Q-015: The group list fetches everything and filters in the browser (S-004)

`GET /v1/groups` returns every group the caller can see -- for a student, their own plus the
ancestors above them; for an administrator, the whole instance. S-004 fetches that once and lets
`DataTable` sort, filter and paginate over it client-side, which is instant and costs one request.

Core-api does offer a `search` parameter on the same endpoint, so the alternative exists. It was
not used because reproducing an instant client-side match with it means a round trip per keystroke,
for a list that had to be fetched in full to render at all. The legacy app makes the same call
(`fetchAllGroups`) on every page load.

**Where this stops being right:** an instance with thousands of groups, where an administrator's
response is large enough that fetching it at all is the cost. At that point the server-side
`search` parameter (plus server-side paging, which core-api does _not_ offer on this endpoint --
checked) becomes the better trade, and `DataTable` would need a "the caller narrows the query"
mode it does not have today. Recorded rather than pre-solved: this deployment has four groups, and
the shape of the fix depends on numbers nobody has yet.

---

## Q-016: A refused page answers HTTP 200 (S-013)

`forbidden()` renders `app/[locale]/forbidden.tsx` correctly -- the reader is told, in words, that
they may not see this -- but the response status is **200**, not 403. Measured with a probe route
whose entire body was `forbidden()`, so this is not about how late in the page the call sits: the
`(app)` shell streams its first bytes before any page body runs, and the status line is written
with them.

DEC-034 chose `experimental.authInterrupts` specifically because it was "the only way to get a real
403/401 status code from the App Router". For a route inside the authenticated shell, that turns
out to be half true: the page is right, the status is not.

**Why it is not fixed here.** The two plausible fixes are both bigger than the ticket that found
this. Deciding the permission in `proxy.ts` would give a real status, but the proxy would have to
ask core-api about the entity on every request -- a round trip per navigation, to answer a question
the page then asks again. Rendering the whole `(app)` shell non-streaming would trade every page's
first paint for a status code that only matters to non-browser clients, since a browser reader sees
the correct page either way.

**What is affected today.** Anything that gates on a permission hint: S-013's per-student solutions
page is the first, and every teacher screen from T-002 onwards will be another. The same shape
applies to core-api's own 403s, which reached the reader as the generic error boundary
("something went wrong") rather than as a refusal -- that was F-030, and it was indeed both the
piece worth doing first and independent of the status code: **F-030 landed (DEC-070) and this
question is unchanged by it.** A refused page now says so in words wherever the refusal comes from,
and still answers 200.

## Q-017: The IP half of an exam lock records infrastructure, not the student (S-008)

Locking into an exam pins the student to the address the lock request came from
(`GroupsPresenter::actionLockStudent` reads `getRemoteAddress()`), and core-api then refuses every
later request from any other address (`BasePresenter::verifyUserIpLock`). In this app the lock
request is made by the **server**, not by the student's browser -- the token never leaves the
server (brief §5) -- so the address recorded is this app's container, the same for every student.

**This is not a regression introduced by the BFF.** In this deployment the legacy frontend does not
record the student's address either: the browser reaches core-api through the nginx `proxy` service,
which does set `X-Forwarded-For`, but core-api's Nette configuration trusts no proxy (there is no
`http: proxy:` entry in the api repo's `config.neon`, checked), so `getRemoteAddress()` is the
proxy container's address for every request. Both frontends therefore record an infrastructure
address; ours is simply a different one.

**What this costs.** The lock still does the thing it is mostly used for -- `groupLock` confines the
student to the exam group, and that is what "secured mode" means in the UI -- but the IP lock does
not pin anyone to the machine in the exam room. The S-008 UI is worded accordingly: the student is
told the group is the only one they can submit in, not that they are tied to this computer, and the
teacher's column is labelled "address recorded" rather than "student's address".

**What would fix it, and why neither is this ticket's.** Either core-api trusts a proxy header (a
config change in the api deployment, plus a decision about who may set it -- and a header this app
sets on behalf of a browser is only as trustworthy as this app's own view of the client), or the
lock is taken by the browser directly against core-api, which needs a token in client JavaScript
and is exactly what brief §5 forbids. Both are operator decisions about the deployment, not code
this repo can write on its own.

## Q-018: This app cannot tell a real invitation from a forged one until it is submitted (S-024)

`/accept-invitation` renders the invited person's name, their email and the invitation's dates
straight out of the JWT in the URL. It does not verify the signature, and **it has no way to**:
core-api signs the token with `accessManager.verificationKey`, which this app deliberately does not
hold (DEC-085), and there is no endpoint that will validate an invitation token on its behalf --
checked against the whole of `openapi/core-api.yaml`, not assumed.

**What this does not cost.** Nothing is granted on the strength of what the page displays. The
account is created by `POST /v1/users/accept-invitation`, which decodes the token with the key it
was signed with and rejects anything else (`InvalidAccessTokenException` → `400-000`). A forged
link ends in "The account could not be created", and no password reaches anyone but core-api.

**What it does cost.** Anyone can craft a link on this deployment's own domain that shows an
arbitrary name and email above a password field. The strings are rendered as text, so there is no
injection -- the exposure is that the page looks legitimate because it _is_ the legitimate page.
That is the same exposure the legacy frontend has (it decodes in the browser and checks only
`exp`), so this is not a regression; it is a gap both frontends inherit from there being nothing to
ask.

**What would close it.** A core-api endpoint that answers "is this invitation token valid and
unused" without creating anything -- the same shape as `users/validate-registration-data`. That is
an API change, which this repo may not make (constraint 1), so it is recorded here for the
operator. Until then the page's own copy is deliberately plain about what it is asking for, and the
`iat`/`exp` pair is shown so a recipient can at least see whether the dates match the mail they
received.

## Q-019: Whether local registration is open has to be configured twice (A-003)

core-api decides whether anybody may create their own account (`localRegistration.enabled`, from
the compose repo's `LOCAL_REGISTRATION_ENABLED` -- **false** on this deployment) and **publishes no
endpoint that reports it**: checked against the whole of `openapi/core-api.yaml`, not assumed. So a
frontend that wants to know before showing a form has to be told separately, which is why the
legacy app carries its own `ALLOW_LOCAL_REGISTRATION` config var and why this app now does too.

**What it costs.** Two places to configure one fact, and they can disagree. If this app says open
while core-api says closed, a reader fills in the form and meets core-api's "Forbidden Request --
Access denied" -- honest, but late. If it says closed while core-api is open, an account that could
have been created is not offered. Neither is dangerous; both are avoidable only by an operator
setting both.

**What would close it.** Anything core-api serves that says so -- a field on an existing public
endpoint (`/v1/instances` already answers `isOpen` per instance and would be a natural home) or a
small `GET /v1/registration-config`. That is an API change, which this repo may not make
(constraint 1), so it is recorded here.

**What is unverified because of it.** On this deployment the success path of A-003 cannot be
exercised at all: the form, the "that address is taken" check and core-api's refusal are verified,
but no account has ever been created through this screen, and neither has the **name-collision**
branch (core-api's `{user: null, usersWithSameName}` answer, which the form turns into "is one of
these you?"). Re-verify both on an instance with local registration enabled.

---

## Q-020: The exercise configuration endpoints publish no schema at all (T-009)

Every endpoint this screen reads and writes -- `/v1/exercises/{id}/tests`, `/config`,
`/environment-configs`, `/score-config`, `/config/variables` -- is described in
`openapi/core-api.yaml` as a `"Placeholder response"` with **no response schema**, and the request
bodies are `type: array, items: {}`. The vocabulary a configuration is built from -- which
variables exist (`expected-output`, `judge-type`, `success-exit-codes`, ...), what their types are,
which pipeline each belongs in, which nine judge programs are built in -- is published nowhere:
core-api validates against it and the legacy frontend hard-codes it in
`helpers/exercise/configSimple.js`.

**What it cost.** The shapes here were read off a live instance and out of the legacy descriptor
table, and are re-stated in `lib/exercise-config/`. That table is now a second copy of an
unpublished contract; an environment or a variable added to core-api will not appear here until
somebody notices. The unit tests pin the shapes against the payloads that were actually observed,
which is the most this side can do.

**What would close it.** Real schemas on those five operations, or -- better -- an endpoint that
serves the descriptor table itself. The pipelines already publish their `parameters`, which is what
makes deciding _where_ a variable goes possible without guessing; what is missing is the list of
variables and their meanings. That is an API change, which this repo may not make (constraint 1).

**What is unverified because of it.** The `data-linux` and `haskell` descriptor variants, and the
five exclusive environments, are ported from the legacy table and have **never been rendered**:
this deployment installs none of them. Re-verify on an instance that has them.
