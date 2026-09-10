# ReCodEx Legacy Web-App — Capability Inventory

**Status:** Swept against the built app, P-001, 2026-09-02
**Source:** `repos/web-app/src/pages/routes.js` + component analysis
**Date:** 2026-05-11, statuses re-derived from the code 2026-09-02

Every `Status` cell below was written during recon and then left alone for four months, so most of
them were wrong in both directions by the time P-001 read them. They now say what the code says, not
what the plan said. The `Destination` columns are the recon plan's and are corrected only where the
plan turned out to name a route that was never built.

| Status            | Meaning                                                     |
| ----------------- | ----------------------------------------------------------- |
| `done`            | Reachable in the new app, whatever screen it ended up on    |
| `partial (G-0xx)` | Most of the row is built; the named ticket says what is not |
| `todo (G-0xx)`    | Not reachable anywhere; the named ticket is the work        |
| `n/a`             | Nothing to port — the legacy app has no such screen either  |

---

## Route Map (from `routes.js`)

| Route (basePath)                                                           | Component                  | Auth  | Link Name                                   | Destination in New IA                                      | Status          |
| -------------------------------------------------------------------------- | -------------------------- | ----- | ------------------------------------------- | ---------------------------------------------------------- | --------------- |
| `''`                                                                       | Home                       | —     | HOME_URI                                    | `/` (public landing)                                       | done            |
| `faq`                                                                      | FAQ                        | —     | FAQ_URL                                     | `/faq`                                                     | done            |
| `login/:redirect?`                                                         | Login                      | —     | LOGIN_URI_FACTORY                           | `/login`                                                   | done            |
| `registration`                                                             | Registration               | false | REGISTRATION_URI                            | `/register`                                                | partial (G-026) |
| `forgotten-password`                                                       | ResetPassword              | —     | RESET_PASSWORD_URI                          | `/forgot-password`                                         | done            |
| `accept-invitation`                                                        | AcceptInvitation           | —     | ACCEPT_INVITATION_URI                       | `/accept-invitation`                                       | done            |
| `accept-group-invitation/:invitationId`                                    | AcceptGroupInvitation      | true  | ACCEPT_GROUP_INVITATION_URI_FACTORY         | `/accept-group-invitation/[id]`                            | done            |
| `app`                                                                      | Dashboard                  | true  | DASHBOARD_URI                               | `/dashboard`                                               | done            |
| `app/assignment/:assignmentId`                                             | Assignment                 | true  | ASSIGNMENT_DETAIL_URI_FACTORY               | `/assignments/[id]`                                        | done            |
| `app/assignment/:assignmentId/user/:userId`                                | Assignment                 | true  | ASSIGNMENT_DETAIL_SPECIFIC_USER_URI_FACTORY | `/assignments/[id]/users/[userId]`                         | done            |
| `app/assignment/:assignmentId/edit`                                        | EditAssignment             | true  | ASSIGNMENT_EDIT_URI_FACTORY                 | `/assignments/[id]/edit`                                   | done            |
| `app/assignment/:assignmentId/solutions`                                   | AssignmentSolutions        | true  | ASSIGNMENT_SOLUTIONS_URI_FACTORY            | `/assignments/[id]/solutions`                              | partial (G-006) |
| `app/assignment/:assignmentId/solution/:solutionId`                        | Solution                   | true  | SOLUTION_DETAIL_URI_FACTORY                 | `/solutions/[id]`                                          | done            |
| `app/assignment/:assignmentId/solution/:solutionId/sources`                | SolutionSourceCodes        | true  | SOLUTION_SOURCE_CODES_URI_FACTORY           | `/solutions/[id]/sources`                                  | done            |
| `app/assignment/:assignmentId/solution/:solutionId/diff/:secondSolutionId` | SolutionSourceCodes        | true  | SOLUTION_SOURCE_CODES_DIFF_URI_FACTORY      | `/solutions/[id]/diff/[otherId]`                           | done            |
| `app/assignment/:assignmentId/solution/:solutionId/plagiarisms`            | SolutionPlagiarisms        | true  | SOLUTION_PLAGIARISMS_URI_FACTORY            | `/solutions/[id]/plagiarisms`                              | done            |
| `app/shadow-assignment/:shadowId`                                          | ShadowAssignment           | true  | SHADOW_ASSIGNMENT_DETAIL_URI_FACTORY        | `/shadow-assignments/[id]`                                 | done            |
| `app/shadow-assignment/:shadowId/edit`                                     | EditShadowAssignment       | true  | SHADOW_ASSIGNMENT_EDIT_URI_FACTORY          | `/shadow-assignments/[id]/edit`                            | done            |
| `app/exercises`                                                            | Exercises                  | true  | EXERCISES_URI                               | `/exercises`                                               | done            |
| `app/exercises/:exerciseId`                                                | Exercise                   | true  | EXERCISE_URI_FACTORY                        | `/exercises/[id]`                                          | done            |
| `app/exercises/:exerciseId/edit`                                           | EditExercise               | true  | EXERCISE_EDIT_URI_FACTORY                   | `/exercises/[id]/edit`                                     | done            |
| `app/exercises/:exerciseId/assignments`                                    | ExerciseAssignments        | true  | EXERCISE_ASSIGNMENTS_URI_FACTORY            | `/exercises/[id]/assignments`                              | done            |
| `app/exercises/:exerciseId/reference-solutions`                            | ExerciseReferenceSolutions | true  | EXERCISE_REFERENCE_SOLUTIONS_URI_FACTORY    | `/exercises/[id]/reference-solutions`                      | done            |
| `app/exercises/:exerciseId/edit-config`                                    | EditExerciseConfig         | true  | EXERCISE_EDIT_CONFIG_URI_FACTORY            | `/exercises/[id]/edit-config`                              | done            |
| `app/exercises/:exerciseId/edit-limits`                                    | EditExerciseLimits         | true  | EXERCISE_EDIT_LIMITS_URI_FACTORY            | `/exercises/[id]/edit-limits`                              | done            |
| `app/exercises/:exerciseId/reference-solution/:referenceSolutionId`        | ReferenceSolution          | true  | REFERENCE_SOLUTION_URI_FACTORY              | `/exercises/[exerciseId]/reference-solutions/[solutionId]` | done            |
| `app/pipelines`                                                            | Pipelines                  | true  | PIPELINES_URI                               | `/pipelines`                                               | done            |
| `app/pipelines/:pipelineId`                                                | Pipeline                   | true  | PIPELINE_URI_FACTORY                        | `/pipelines/[id]`                                          | done            |
| `app/pipelines/:pipelineId/edit`                                           | EditPipeline               | true  | PIPELINE_EDIT_URI_FACTORY                   | `/pipelines/[id]/edit`                                     | done            |
| `app/pipelines/:pipelineId/edit-struct`                                    | EditPipelineStructure      | true  | PIPELINE_EDIT_STRUCT_URI_FACTORY            | `/pipelines/[id]/edit-struct` (merged into `/edit`, T-016) | done            |
| `app/group/:groupId/edit`                                                  | EditGroup                  | true  | GROUP_EDIT_URI_FACTORY                      | `/groups/[id]?tab=settings`                                | done            |
| `app/group/:groupId/info`                                                  | GroupInfo                  | true  | GROUP_INFO_URI_FACTORY                      | `/groups/[id]?tab=info`                                    | done            |
| `app/group/:groupId/assignments`                                           | GroupAssignments           | true  | GROUP_ASSIGNMENTS_URI_FACTORY               | `/groups/[id]?tab=assignments`                             | done            |
| `app/group/:groupId/students`                                              | GroupStudents              | true  | GROUP_STUDENTS_URI_FACTORY                  | `/groups/[id]?tab=students`                                | done            |
| `app/group/:groupId/exams`                                                 | GroupExams                 | true  | GROUP_EXAMS_URI_FACTORY                     | `/groups/[id]?tab=exams`                                   | done            |
| `app/group/:groupId/exams/:examId`                                         | GroupExams                 | true  | GROUP_EXAMS_SPECIFIC_EXAM_URI_FACTORY       | `/groups/[id]?tab=exams&exam=[examId]`                     | done            |
| `app/group/:groupId/user/:userId`                                          | GroupUserSolutions         | true  | GROUP_USER_SOLUTIONS_URI_FACTORY            | `/groups/[id]/users/[userId]`                              | done            |
| `app/instance/:instanceId`                                                 | Instance                   | true  | INSTANCE_URI_FACTORY                        | merged into `/admin/instances/[id]` (DEC-113)              | done            |
| `app/users`                                                                | Users                      | true  | USERS_URI                                   | `/users`                                                   | done            |
| `app/user/:userId`                                                         | User                       | true  | USER_URI_FACTORY                            | `/users/[id]`                                              | done            |
| `app/user/:userId/edit`                                                    | EditUser                   | true  | EDIT_USER_URI_FACTORY                       | `/profile/edit` (self), `/users/[id]/edit` (admin)         | done            |
| `app/submission-failures`                                                  | SubmissionFailures         | true  | FAILURES_URI                                | `/submission-failures`                                     | done            |
| `app/system-messages`                                                      | SystemMessages             | true  | MESSAGES_URI                                | `/system-messages`                                         | done            |
| `app/archive`                                                              | Archive                    | true  | ARCHIVE_URI                                 | `/archive`                                                 | done            |
| `app/server`                                                               | ServerManagement           | true  | SERVER_MANAGEMENT_URI                       | `/admin`                                                   | done            |
| `admin/instances`                                                          | Instances                  | true  | ADMIN_INSTANCES_URI                         | `/admin/instances`                                         | done            |
| `admin/instances/:instanceId/edit`                                         | EditInstances              | true  | ADMIN_EDIT_INSTANCE_URI_FACTORY             | merged into `/admin/instances/[id]` (DEC-113)              | done            |
| `forgotten-password/change`                                                | ChangePassword             | —     | —                                           | `/forgot-password/change`                                  | done            |
| `email-verification`                                                       | EmailVerification          | —     | —                                           | `/email-verification`                                      | done            |
| `*`                                                                        | NotFound                   | —     | —                                           | `not-found.tsx` / `forbidden.tsx` / `unauthorized.tsx`     | done            |

---

## Redux Modules (Capabilities)

| Module                         | Purpose                                                    | New IA Destination                                                                             | Status                 |
| ------------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------- |
| `app`                          | Global app state (locale, title)                           | Server Components + `params.lang`                                                              | done                   |
| `assignments`                  | Assignment CRUD, detail, edit                              | `assignments/[id]`                                                                             | done                   |
| `asyncJobs`                    | Async job polling (evaluation progress)                    | `admin` (list, ping, abort)                                                                    | done                   |
| `auth`                         | Login, logout, token refresh, takeover                     | BFF + httpOnly cookies                                                                         | done                   |
| `boxes`                        | Box component (UI primitive)                               | shadcn/ui Card                                                                                 | done                   |
| `broker`                       | Broker communication (evaluation)                          | `admin` (stats, freeze/unfreeze)                                                               | done                   |
| `canSubmit`                    | Permission: can user submit to assignment                  | Server Component data fetching                                                                 | done                   |
| `comments`                     | Discussion threads on exercises, assignments and solutions | `exercises/[id]`, `assignments/[id]`, `solutions/[id]` (T-022)                                 | done                   |
| `emailVerification`            | Email verification flow                                    | `/email-verification`                                                                          | done                   |
| `evaluationProgress`           | Live evaluation progress (WebSocket/polling)               | `solutions/[id]` live updates                                                                  | done                   |
| `exerciseAuthors`              | Exercise author and administrators                         | `exercises/[id]/edit`                                                                          | done                   |
| `exerciseConfigs`              | Exercise configuration (pipelines, variables)              | `exercises/[id]/edit-config`                                                                   | done                   |
| `exerciseEnvironmentConfigs`   | Per-environment config                                     | `exercises/[id]/edit-config`                                                                   | done                   |
| `exerciseFiles`                | Exercise supplementary files                               | `exercises/[id]/edit`                                                                          | done                   |
| `exerciseFilesLinks`           | File links, and `%%key%%` in authored texts                | `exercises/[id]/edit`                                                                          | done                   |
| `exercisePipelinesVariables`   | Pipeline variables (advanced config only — T-024)          | `exercises/[id]/edit-config`                                                                   | done                   |
| `exerciseScoreConfig`          | Score configuration                                        | `exercises/[id]/edit-config`                                                                   | done                   |
| `exerciseTests`                | Exercise tests                                             | `exercises/[id]/edit-config`                                                                   | done                   |
| `exercises`                    | Exercise catalog, detail, edit                             | `exercises`                                                                                    | done                   |
| `files`                        | Uploaded files                                             | `upload` component                                                                             | done                   |
| `filesContent`                 | File content preview                                       | `solutions/[id]`                                                                               | done                   |
| `groupExamLocks`               | Exam mode locks                                            | `groups/[id]?tab=exams`                                                                        | done                   |
| `groupExercises`               | Group-specific exercises                                   | `groups/[id]/assignments`                                                                      | done                   |
| `groupInvitations`             | Group invitations                                          | `accept-group-invitation`                                                                      | done                   |
| `groupResults`                 | Group results overview                                     | `groups/[id]?tab=students`                                                                     | done                   |
| `groups`                       | Group CRUD, hierarchy, membership                          | `groups`                                                                                       | done                   |
| `hwGroups`                     | Hardware groups                                            | Read-only vocabulary in the limits editor — no admin screen in legacy either (DEC-114)         | n/a                    |
| `instances`                    | Instance management                                        | `admin/instances`                                                                              | done                   |
| `licences`                     | Licence management                                         | `admin/instances/[id]`                                                                         | done                   |
| `limits`                       | Exercise limits (per environment, per hardware group)      | `exercises/[id]/edit-limits`                                                                   | done                   |
| `notifications`                | In-app notifications                                       | Header + dashboard                                                                             | done                   |
| `pagination`                   | Pagination state                                           | `searchParams` in Server Components                                                            | done                   |
| `pipelineFiles`                | Pipeline files                                             | `pipelines/[id]/edit`                                                                          | done                   |
| `pipelines`                    | Pipeline CRUD, structure                                   | `pipelines`                                                                                    | partial (G-017)        |
| `plagiarisms`                  | Plagiarism detection                                       | `solutions/[id]/plagiarisms`                                                                   | done                   |
| `referenceSolutionEvaluations` | Reference solution evaluations                             | `reference-solutions/[id]`                                                                     | done                   |
| `referenceSolutions`           | Reference solutions                                        | `exercises/[id]/reference-solutions`                                                           | done                   |
| `registration`                 | User registration                                          | `/register`                                                                                    | done                   |
| `runtimeEnvironments`          | Runtime environments                                       | Read-only vocabulary in the config/limits editors — no admin screen in legacy either (DEC-114) | n/a                    |
| `shadowAssignments`            | Shadow assignments (bonus)                                 | `shadow-assignments/[id]`                                                                      | partial (G-009)        |
| `solutionFiles`                | Solution source files                                      | `solutions/[id]/sources`                                                                       | done                   |
| `solutionReviews`              | Review comments on solutions                               | `solutions/[id]`                                                                               | partial (G-027)        |
| `solutions`                    | Solution CRUD, evaluation                                  | `solutions/[id]`                                                                               | partial (G-002, G-003) |
| `stats`                        | Group/assignment statistics                                | `groups/[id]`                                                                                  | done                   |
| `submission`                   | Active submission state                                    | `assignments/[id]`                                                                             | done                   |
| `submissionEvaluations`        | Evaluation results                                         | `solutions/[id]`                                                                               | done                   |
| `submissionFailures`           | Submission failure log                                     | `submission-failures`                                                                          | done                   |
| `systemMessages`               | System messages                                            | `system-messages` + the app shell                                                              | done                   |
| `upload`                       | File upload state                                          | `lib/upload/use-file-upload.ts`                                                                | done                   |
| `userCalendars`                | User deadlines calendar                                    | `/profile/edit`                                                                                | done                   |
| `userSwitching`                | User switching (superadmin)                                | `users/[id]`                                                                                   | done                   |
| `users`                        | User management                                            | `users`, `admin/users`                                                                         | done                   |
| `usersGroups`                  | User-group membership                                      | `groups/[id]/students`                                                                         | done                   |

---

## Key Mechanisms to Reproduce

| Mechanism               | Legacy Implementation                                   | New Implementation                           | Status                 |
| ----------------------- | ------------------------------------------------------- | -------------------------------------------- | ---------------------- |
| **Auth token storage**  | `localStorage` JWT                                      | httpOnly cookie + BFF (F-016)                | done                   |
| **Token refresh**       | `redux` middleware auto-refresh                         | `proxy.ts` + Route Handler (F-018)           | done                   |
| **External auth (CAS)** | Popup window + `postMessage` back to opener             | Redirect to callback, no popup (F-019/A-007) | done                   |
| **User takeover**       | `POST /login/takeover/:userId`                          | Route Handler (F-020)                        | done                   |
| **Restricted tokens**   | `POST /login/issue-restricted-token`                    | Route Handler (F-021)                        | partial (G-020, G-023) |
| **File upload**         | Per-partes chunked upload via `apiMiddleware`           | Route Handler streaming (§6.7), D-005        | done                   |
| **Evaluation progress** | `evaluationProgress` module (WebSocket/polling)         | TanStack Query + WebSocket/polling           | done                   |
| **Permission hints**    | `canSubmit`, `canViewDetail`, etc. on entities          | Server Component data fetching               | done                   |
| **i18n**                | `react-intl` with cs/en messages                        | `next-intl`                                  | done                   |
| **Markdown rendering**  | `markdown-it` + KaTeX                                   | `react-markdown` + remark-gfm + rehype-katex | done                   |
| **Code highlighting**   | `highlight.js` + `prismjs` + `react-syntax-highlighter` | Shiki (server) + CodeMirror 6 (editor)       | partial (G-028)        |
| **Diff viewer**         | `react-diff-viewer`                                     | Dedicated diff component                     | todo (G-005)           |
| **Graphviz rendering**  | `viz.js` (WASM) for pipeline structure                  | Port or replace (§7)                         | done                   |
| **QR code of page**     | Header dropdown                                         | Sidebar footer, a dialog                     | done                   |
| **Breadcrumbs**         | Missing/inconsistent                                    | Central manifest + PageShell                 | done                   |

---

## Domain Landmines (from brief §7)

| Item                                               | Legacy Evidence                                            | Action Required                                                                                                   | Status          |
| -------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------- |
| WebSocket for evaluation progress                  | `evaluationProgress` module                                | Check compose repo `services/monitor/`                                                                            | done            |
| Registration / password reset / email verification | `Registration`, `ResetPassword`, `EmailVerification` pages | Build flows against API                                                                                           | done            |
| Solution diffing                                   | `SolutionSourceCodes` with diff route                      | Keep capability                                                                                                   | todo (G-005)    |
| Pipeline visualisation (Graphviz)                  | `EditPipelineStructure`                                    | Decide: viz.js, server-side, or JS layout                                                                         | done            |
| Markdown compatibility                             | `markdown-it` + KaTeX in exercise texts                    | Test against real data                                                                                            | done            |
| Third-party extensions                             | `SIS-ext-webapp` repo mentioned                            | Investigate token handoff                                                                                         | partial (G-020) |
| QR code of current page                            | Header component                                           | Reproduce                                                                                                         | done            |
| Archived/organisational groups                     | `groups` module                                            | Filter in UI                                                                                                      | done            |
| Group invitations                                  | `AcceptGroupInvitation` page                               | Accepting (S-023) and minting (T-018)                                                                             | done            |
| Nested subgroups                                   | `groups` module                                            | Tree navigation                                                                                                   | done            |
| Points exports                                     | `groupResults` module                                      | CSV via a Route Handler (T-007)                                                                                   | done            |
| Attempt limits                                     | `limits` module                                            | Per-assignment config                                                                                             | done            |
| Per-environment assignment settings                | `exerciseEnvironmentConfigs`                               | `assignments/[id]/edit`                                                                                           | done            |
| Success-exit-code config                           | `exerciseConfigs`                                          | `exercises/[id]/edit-config` (T-009)                                                                              | done            |
| Judge log display                                  | `submissionEvaluations`                                    | `solutions/[id]`                                                                                                  | done            |
| Deprecated SIS integration                         | Separate repo                                              | Nothing to port — the legacy web-app has no SIS screen; the extension token handoff is PEND-002 / Q-012 / DEF-005 | n/a             |

---

## Notes

- All routes are prefixed with `URL_PATH_PREFIX` in legacy. New repo must support `basePath` via build arg.
- `LOGIN_URI_PREFIX` is dynamic — check `api/tools.js` for exact value.
- `auth=true` routes require login; `auth=false` routes redirect to dashboard if logged in.
- `customLoadGroups` indicates pages that load group-specific data on mount.
- `pathRelatedGroupSelector` derives groupId from URL for breadcrumbs and navigation context.
