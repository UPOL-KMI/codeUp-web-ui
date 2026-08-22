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
