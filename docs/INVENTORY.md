# ReCodEx Legacy Web-App — Capability Inventory

**Status:** Draft — recon complete, pending operator review
**Source:** `repos/web-app/src/pages/routes.js` + component analysis
**Date:** 2026-05-11

---

## Route Map (from `routes.js`)

| Route (basePath)                                                           | Component                  | Auth  | Link Name                                   | Destination in New IA                  | Status |
| -------------------------------------------------------------------------- | -------------------------- | ----- | ------------------------------------------- | -------------------------------------- | ------ |
| `''`                                                                       | Home                       | —     | HOME_URI                                    | `/` (public landing)                   | todo   |
| `faq`                                                                      | FAQ                        | —     | FAQ_URL                                     | `/faq`                                 | todo   |
| `login/:redirect?`                                                         | Login                      | —     | LOGIN_URI_FACTORY                           | `/login`                               | todo   |
| `registration`                                                             | Registration               | false | REGISTRATION_URI                            | `/register`                            | todo   |
| `forgotten-password`                                                       | ResetPassword              | —     | RESET_PASSWORD_URI                          | `/forgot-password`                     | todo   |
| `accept-invitation`                                                        | AcceptInvitation           | —     | ACCEPT_INVITATION_URI                       | `/accept-invitation`                   | done   |
| `accept-group-invitation/:invitationId`                                    | AcceptGroupInvitation      | true  | ACCEPT_GROUP_INVITATION_URI_FACTORY         | `/accept-group-invitation/[id]`        | done   |
| `app`                                                                      | Dashboard                  | true  | DASHBOARD_URI                               | `/dashboard`                           | done   |
| `app/assignment/:assignmentId`                                             | Assignment                 | true  | ASSIGNMENT_DETAIL_URI_FACTORY               | `/assignments/[id]`                    | done   |
| `app/assignment/:assignmentId/user/:userId`                                | Assignment                 | true  | ASSIGNMENT_DETAIL_SPECIFIC_USER_URI_FACTORY | `/assignments/[id]/users/[userId]`     | done   |
| `app/assignment/:assignmentId/edit`                                        | EditAssignment             | true  | ASSIGNMENT_EDIT_URI_FACTORY                 | `/assignments/[id]/edit`               | done   |
| `app/assignment/:assignmentId/solutions`                                   | AssignmentSolutions        | true  | ASSIGNMENT_SOLUTIONS_URI_FACTORY            | `/assignments/[id]/solutions`          | done   |
| `app/assignment/:assignmentId/solution/:solutionId`                        | Solution                   | true  | SOLUTION_DETAIL_URI_FACTORY                 | `/solutions/[id]`                      | todo   |
| `app/assignment/:assignmentId/solution/:solutionId/sources`                | SolutionSourceCodes        | true  | SOLUTION_SOURCE_CODES_URI_FACTORY           | `/solutions/[id]/sources`              | todo   |
| `app/assignment/:assignmentId/solution/:solutionId/diff/:secondSolutionId` | SolutionSourceCodes        | true  | SOLUTION_SOURCE_CODES_DIFF_URI_FACTORY      | `/solutions/[id]/diff/[otherId]`       | todo   |
| `app/assignment/:assignmentId/solution/:solutionId/plagiarisms`            | SolutionPlagiarisms        | true  | SOLUTION_PLAGIARISMS_URI_FACTORY            | `/solutions/[id]/plagiarisms`          | done   |
| `app/shadow-assignment/:shadowId`                                          | ShadowAssignment           | true  | SHADOW_ASSIGNMENT_DETAIL_URI_FACTORY        | `/shadow-assignments/[id]`             | done   |
| `app/shadow-assignment/:shadowId/edit`                                     | EditShadowAssignment       | true  | SHADOW_ASSIGNMENT_EDIT_URI_FACTORY          | `/shadow-assignments/[id]/edit`        | todo   |
| `app/exercises`                                                            | Exercises                  | true  | EXERCISES_URI                               | `/exercises`                           | done   |
| `app/exercises/:exerciseId`                                                | Exercise                   | true  | EXERCISE_URI_FACTORY                        | `/exercises/[id]`                      | done   |
| `app/exercises/:exerciseId/edit`                                           | EditExercise               | true  | EXERCISE_EDIT_URI_FACTORY                   | `/exercises/[id]/edit`                 | todo   |
| `app/exercises/:exerciseId/assignments`                                    | ExerciseAssignments        | true  | EXERCISE_ASSIGNMENTS_URI_FACTORY            | `/exercises/[id]/assignments`          | todo   |
| `app/exercises/:exerciseId/reference-solutions`                            | ExerciseReferenceSolutions | true  | EXERCISE_REFERENCE_SOLUTIONS_URI_FACTORY    | `/exercises/[id]/reference-solutions`  | todo   |
| `app/exercises/:exerciseId/edit-config`                                    | EditExerciseConfig         | true  | EXERCISE_EDIT_CONFIG_URI_FACTORY            | `/exercises/[id]/edit-config`          | todo   |
| `app/exercises/:exerciseId/edit-limits`                                    | EditExerciseLimits         | true  | EXERCISE_EDIT_LIMITS_URI_FACTORY            | `/exercises/[id]/edit-limits`          | todo   |
| `app/exercises/:exerciseId/reference-solution/:referenceSolutionId`        | ReferenceSolution          | true  | REFERENCE_SOLUTION_URI_FACTORY              | `/reference-solutions/[id]`            | todo   |
| `app/pipelines`                                                            | Pipelines                  | true  | PIPELINES_URI                               | `/pipelines`                           | todo   |
| `app/pipelines/:pipelineId`                                                | Pipeline                   | true  | PIPELINE_URI_FACTORY                        | `/pipelines/[id]`                      | todo   |
| `app/pipelines/:pipelineId/edit`                                           | EditPipeline               | true  | PIPELINE_EDIT_URI_FACTORY                   | `/pipelines/[id]/edit`                 | todo   |
| `app/pipelines/:pipelineId/edit-struct`                                    | EditPipelineStructure      | true  | PIPELINE_EDIT_STRUCT_URI_FACTORY            | `/pipelines/[id]/edit-struct`          | todo   |
| `app/group/:groupId/edit`                                                  | EditGroup                  | true  | GROUP_EDIT_URI_FACTORY                      | `/groups/[id]?tab=settings`            | done   |
| `app/group/:groupId/info`                                                  | GroupInfo                  | true  | GROUP_INFO_URI_FACTORY                      | `/groups/[id]?tab=info`                | done   |
| `app/group/:groupId/assignments`                                           | GroupAssignments           | true  | GROUP_ASSIGNMENTS_URI_FACTORY               | `/groups/[id]?tab=assignments`         | done   |
| `app/group/:groupId/students`                                              | GroupStudents              | true  | GROUP_STUDENTS_URI_FACTORY                  | `/groups/[id]?tab=students`            | done   |
| `app/group/:groupId/exams`                                                 | GroupExams                 | true  | GROUP_EXAMS_URI_FACTORY                     | `/groups/[id]?tab=exams`               | done   |
| `app/group/:groupId/exams/:examId`                                         | GroupExams                 | true  | GROUP_EXAMS_SPECIFIC_EXAM_URI_FACTORY       | `/groups/[id]?tab=exams&exam=[examId]` | done   |
| `app/group/:groupId/user/:userId`                                          | GroupUserSolutions         | true  | GROUP_USER_SOLUTIONS_URI_FACTORY            | `/groups/[id]/users/[userId]`          | done   |
| `app/instance/:instanceId`                                                 | Instance                   | true  | INSTANCE_URI_FACTORY                        | `/instances/[id]`                      | todo   |
| `app/users`                                                                | Users                      | true  | USERS_URI                                   | `/users`                               | todo   |
| `app/user/:userId`                                                         | User                       | true  | USER_URI_FACTORY                            | `/users/[id]`                          | done   |
| `app/user/:userId/edit`                                                    | EditUser                   | true  | EDIT_USER_URI_FACTORY                       | `/profile/edit` (self)                 | done   |
| `app/submission-failures`                                                  | SubmissionFailures         | true  | FAILURES_URI                                | `/submission-failures`                 | done   |
| `app/system-messages`                                                      | SystemMessages             | true  | MESSAGES_URI                                | `/system-messages`                     | todo   |
| `app/archive`                                                              | Archive                    | true  | ARCHIVE_URI                                 | `/archive`                             | todo   |
| `app/server`                                                               | ServerManagement           | true  | SERVER_MANAGEMENT_URI                       | `/admin/server`                        | todo   |
| `admin/instances`                                                          | Instances                  | true  | ADMIN_INSTANCES_URI                         | `/admin/instances`                     | todo   |
| `admin/instances/:instanceId/edit`                                         | EditInstances              | true  | ADMIN_EDIT_INSTANCE_URI_FACTORY             | `/admin/instances/[id]/edit`           | todo   |
| `forgotten-password/change`                                                | ChangePassword             | —     | —                                           | `/forgot-password/change`              | todo   |
| `email-verification`                                                       | EmailVerification          | —     | —                                           | `/email-verification`                  | todo   |
| `*`                                                                        | NotFound                   | —     | —                                           | `/[...not-found]`                      | todo   |

---

## Redux Modules (Capabilities)

| Module                         | Purpose                                                    | New IA Destination                             | Status |
| ------------------------------ | ---------------------------------------------------------- | ---------------------------------------------- | ------ |
| `app`                          | Global app state (locale, title)                           | Server Components + `params.lang`              | todo   |
| `assignments`                  | Assignment CRUD, detail, edit                              | `assignments/[id]`                             | todo   |
| `asyncJobs`                    | Async job polling (evaluation progress)                    | Server Actions + WebSocket/polling             | todo   |
| `auth`                         | Login, logout, token refresh, takeover                     | BFF + httpOnly cookies                         | todo   |
| `boxes`                        | Box component (UI primitive)                               | shadcn/ui Card                                 | todo   |
| `broker`                       | Broker communication (evaluation)                          | Server Actions                                 | todo   |
| `canSubmit`                    | Permission: can user submit to assignment                  | Server Component data fetching                 | todo   |
| `comments`                     | Discussion threads on exercises, assignments and solutions | T-022 (**not** S-018's inline review comments) | todo   |
| `emailVerification`            | Email verification flow                                    | `/email-verification`                          | todo   |
| `evaluationProgress`           | Live evaluation progress (WebSocket/polling)               | `solutions/[id]` live updates                  | todo   |
| `exerciseAuthors`              | Exercise author management                                 | `exercises/[id]`                               | todo   |
| `exerciseConfigs`              | Exercise configuration (pipelines, variables)              | `exercises/[id]/edit-config`                   | todo   |
| `exerciseEnvironmentConfigs`   | Per-environment config                                     | `exercises/[id]/edit-config`                   | todo   |
| `exerciseFiles`                | Exercise supplementary files                               | `exercises/[id]`                               | todo   |
| `exerciseFilesLinks`           | File links                                                 | `exercises/[id]`                               | todo   |
| `exercisePipelinesVariables`   | Pipeline variables                                         | `exercises/[id]/edit-config`                   | todo   |
| `exerciseScoreConfig`          | Score configuration                                        | `exercises/[id]`                               | todo   |
| `exerciseTests`                | Exercise tests                                             | `exercises/[id]`                               | todo   |
| `exercises`                    | Exercise catalog, detail, edit                             | `exercises`                                    | todo   |
| `files`                        | Uploaded files                                             | `upload` component                             | todo   |
| `filesContent`                 | File content preview                                       | `solutions/[id]`                               | todo   |
| `groupExamLocks`               | Exam mode locks                                            | `groups/[id]?tab=exams`                        | done   |
| `groupExercises`               | Group-specific exercises                                   | `groups/[id]/assignments`                      | todo   |
| `groupInvitations`             | Group invitations                                          | `accept-group-invitation`                      | done   |
| `groupResults`                 | Group results overview                                     | `groups/[id]?tab=students`                     | done   |
| `groups`                       | Group CRUD, hierarchy, membership                          | `groups`                                       | todo   |
| `hwGroups`                     | Hardware groups                                            | `admin/server`                                 | todo   |
| `instances`                    | Instance management                                        | `admin/instances`                              | todo   |
| `licences`                     | Licence management                                         | `admin`                                        | todo   |
| `limits`                       | Assignment/exercise limits                                 | `assignments/[id]/edit`                        | todo   |
| `notifications`                | In-app notifications                                       | Header + dashboard                             | todo   |
| `pagination`                   | Pagination state                                           | `searchParams` in Server Components            | todo   |
| `pipelineFiles`                | Pipeline files                                             | `pipelines/[id]`                               | todo   |
| `pipelines`                    | Pipeline CRUD, structure                                   | `pipelines`                                    | todo   |
| `plagiarisms`                  | Plagiarism detection                                       | `solutions/[id]/plagiarisms`                   | done   |
| `referenceSolutionEvaluations` | Reference solution evaluations                             | `reference-solutions/[id]`                     | todo   |
| `referenceSolutions`           | Reference solutions                                        | `exercises/[id]/reference-solutions`           | todo   |
| `registration`                 | User registration                                          | `/register`                                    | todo   |
| `runtimeEnvironments`          | Runtime environments                                       | `admin/server`                                 | todo   |
| `shadowAssignments`            | Shadow assignments (bonus)                                 | `shadow-assignments/[id]`                      | done   |
| `solutionFiles`                | Solution source files                                      | `solutions/[id]/sources`                       | todo   |
| `solutionReviews`              | Review comments on solutions                               | `solutions/[id]`                               | todo   |
| `solutions`                    | Solution CRUD, evaluation                                  | `solutions/[id]`                               | todo   |
| `stats`                        | Group/assignment statistics                                | `groups/[id]`                                  | todo   |
| `submission`                   | Active submission state                                    | `assignments/[id]`                             | todo   |
| `submissionEvaluations`        | Evaluation results                                         | `solutions/[id]`                               | todo   |
| `submissionFailures`           | Submission failure log                                     | `submission-failures`                          | done   |
| `systemMessages`               | System messages                                            | `system-messages`                              | todo   |
| `upload`                       | File upload state                                          | `lib/upload/use-file-upload.ts`                | done   |
| `userCalendars`                | User deadlines calendar                                    | `/profile/edit`                                | done   |
| `userSwitching`                | User switching (superadmin)                                | `admin/users`                                  | todo   |
| `users`                        | User management                                            | `users`, `admin/users`                         | todo   |
| `usersGroups`                  | User-group membership                                      | `groups/[id]/students`                         | todo   |

---

## Key Mechanisms to Reproduce

| Mechanism               | Legacy Implementation                                   | New Implementation                           | Status |
| ----------------------- | ------------------------------------------------------- | -------------------------------------------- | ------ |
| **Auth token storage**  | `localStorage` JWT                                      | httpOnly cookie + BFF (F-016)                | done   |
| **Token refresh**       | `redux` middleware auto-refresh                         | `proxy.ts` + Route Handler (F-018)           | done   |
| **External auth (CAS)** | Popup window + redirect callback                        | Route Handler callback (F-019)               | done   |
| **User takeover**       | `POST /login/takeover/:userId`                          | Route Handler (F-020)                        | done   |
| **Restricted tokens**   | `POST /login/issue-restricted-token`                    | Route Handler (F-021)                        | done   |
| **File upload**         | Per-partes chunked upload via `apiMiddleware`           | Route Handler streaming (§6.7), D-005        | done   |
| **Evaluation progress** | `evaluationProgress` module (WebSocket/polling)         | TanStack Query + WebSocket/polling           | todo   |
| **Permission hints**    | `canSubmit`, `canViewDetail`, etc. on entities          | Server Component data fetching               | todo   |
| **i18n**                | `react-intl` with cs/en messages                        | `next-intl`                                  | todo   |
| **Markdown rendering**  | `markdown-it` + KaTeX                                   | `react-markdown` + remark-gfm + rehype-katex | todo   |
| **Code highlighting**   | `highlight.js` + `prismjs` + `react-syntax-highlighter` | Shiki (server) + CodeMirror 6 (editor)       | todo   |
| **Diff viewer**         | `react-diff-viewer`                                     | Dedicated diff component                     | todo   |
| **Graphviz rendering**  | `viz.js` (WASM) for pipeline structure                  | Port or replace (§7)                         | todo   |
| **QR code of page**     | Header dropdown                                         | Header dropdown                              | todo   |
| **Breadcrumbs**         | Missing/inconsistent                                    | Central manifest + PageShell                 | todo   |

---

## Domain Landmines (from brief §7)

| Item                                               | Legacy Evidence                                            | Action Required                           | Status |
| -------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------- | ------ |
| WebSocket for evaluation progress                  | `evaluationProgress` module                                | Check compose repo `services/monitor/`    | todo   |
| Registration / password reset / email verification | `Registration`, `ResetPassword`, `EmailVerification` pages | Build flows against API                   | todo   |
| Solution diffing                                   | `SolutionSourceCodes` with diff route                      | Keep capability                           | todo   |
| Pipeline visualisation (Graphviz)                  | `EditPipelineStructure`                                    | Decide: viz.js, server-side, or JS layout | todo   |
| Markdown compatibility                             | `markdown-it` + KaTeX in exercise texts                    | Test against real data                    | todo   |
| Third-party extensions                             | `SIS-ext-webapp` repo mentioned                            | Investigate token handoff                 | todo   |
| QR code of current page                            | Header component                                           | Reproduce                                 | todo   |
| Archived/organisational groups                     | `groups` module                                            | Filter in UI                              | todo   |
| Group invitations                                  | `AcceptGroupInvitation` page                               | Accepting (S-023) and minting (T-018)     | done   |
| Nested subgroups                                   | `groups` module                                            | Tree navigation                           | todo   |
| Points exports                                     | `groupResults` module                                      | CSV via a Route Handler (T-007)           | done   |
| Attempt limits                                     | `limits` module                                            | Per-assignment config                     | todo   |
| Per-environment assignment settings                | `exerciseEnvironmentConfigs`                               | `assignments/[id]/edit`                   | todo   |
| Success-exit-code config                           | `exerciseScoreConfig`                                      | `exercises/[id]/edit`                     | todo   |
| Judge log display                                  | `submissionEvaluations`                                    | `solutions/[id]`                          | todo   |
| Deprecated SIS integration                         | Separate repo                                              | Document or drop                          | todo   |

---

## Notes

- All routes are prefixed with `URL_PATH_PREFIX` in legacy. New repo must support `basePath` via build arg.
- `LOGIN_URI_PREFIX` is dynamic — check `api/tools.js` for exact value.
- `auth=true` routes require login; `auth=false` routes redirect to dashboard if logged in.
- `customLoadGroups` indicates pages that load group-specific data on mount.
- `pathRelatedGroupSelector` derives groupId from URL for breadcrumbs and navigation context.
