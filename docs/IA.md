# ReCodEx New Frontend — Information Architecture (IA)

**Status:** Draft — pending operator review
**Date:** 2026-05-11
**Assumption tag:** `IA-ASSUMPTION`

---

## 1. Design Principles

1. **Two audiences, one person.** A user can be a student in one group and a teacher in another. The UI never asks "are you a student or teacher?" — it derives capabilities from per-group permission hints returned by the API.
2. **Context over persona.** Routing follows the _context_ (group, assignment, solution), not the user's global role. No `(student)` or `(teacher)` route groups.
3. **Dashboard is a landing pad, not a destination.** On login, the user sees _immediately_ what requires their attention: upcoming deadlines (student) or unreviewed submissions (teacher). No unnecessary clicks.
4. **Breadcrumbs are mandatory.** Every page below the top level renders breadcrumbs from a central route manifest. This is a named complaint about the legacy app.
5. **Deep-linkable everything.** Filters, tabs, pagination, and sort state live in `searchParams`. Sharing a URL reproduces the exact view.
6. **Mobile-first responsive.** Students check deadlines on phones. The layout must work at 320px without horizontal scroll.

---

## 2. Sitemap

```
/
├── /login
├── /register
├── /forgot-password
│   └── /forgot-password/change
├── /email-verification
├── /accept-invitation
├── /accept-group-invitation/[invitationId]
├── /faq
│
├── /dashboard                    (authenticated landing)
│   ├── /dashboard?tab=student    (deep-link: my deadlines & submissions)
│   ├── /dashboard?tab=teacher    (deep-link: unreviewed & upcoming)
│   └── /dashboard?tab=calendar   (deep-link: full calendar view)
│
├── /groups
│   ├── /groups                   (list: my groups + discover)
│   ├── /groups/[groupId]
│   │   ├── /info                 (overview, stats, description)
│   │   ├── /assignments          (assignment list for this group)
│   │   ├── /students             (roster, points overview)
│   │   ├── /exams                (exam mode management)
│   │   ├── /exams/[examId]       (specific exam detail)
│   │   ├── /edit                 (settings, members, invitations)
│   │   └── /users/[userId]       (user solutions in this group)
│   └── /groups/new               (create group — from list)
│
├── /assignments/[assignmentId]
│   ├── /assignments/[id]         (detail: description, deadlines, my submissions)
│   ├── /assignments/[id]/edit    (settings: deadlines, points, limits, visibility)
│   ├── /assignments/[id]/solutions (all submissions for this assignment)
│   └── /assignments/[id]/users/[userId] (specific user's view)
│
├── /solutions/[solutionId]
│   ├── /solutions/[id]           (evaluation result, review, comments)
│   ├── /solutions/[id]/sources   (source code viewer)
│   ├── /solutions/[id]/diff/[otherId] (compare two solutions)
│   └── /solutions/[id]/plagiarisms (plagiarism report)
│
├── /shadow-assignments/[shadowId]
│   ├── /shadow-assignments/[id]  (bonus assignment detail)
│   └── /shadow-assignments/[id]/edit
│
├── /exercises
│   ├── /exercises                (catalog: search, filter, create)
│   ├── /exercises/[exerciseId]
│   │   ├── /exercises/[id]       (detail: description, tests, limits)
│   │   ├── /exercises/[id]/edit  (basic settings)
│   │   ├── /exercises/[id]/edit-config (pipeline config, variables — hardest screen)
│   │   ├── /exercises/[id]/edit-limits (per-environment limits)
│   │   ├── /exercises/[id]/assignments (assignments created from this exercise)
│   │   └── /exercises/[id]/reference-solutions
│   │       └── /reference-solutions/[id] (evaluation, sources)
│   └── /exercises/new            (create exercise)
│
├── /pipelines
│   ├── /pipelines                (list)
│   ├── /pipelines/[pipelineId]
│   │   ├── /pipelines/[id]       (detail)
│   │   ├── /pipelines/[id]/edit  (edit structure)
│   │   └── /pipelines/[id]/edit-struct (Graphviz visual editor)
│   └── /pipelines/new            (create)
│
├── /users
│   ├── /users                    (list, search — admin/teacher)
│   ├── /users/[userId]
│   │   ├── /users/[id]           (profile, groups, solutions)
│   │   └── /users/[id]/edit      (admin edit)
│   └── /users/[id]/takeover      (superadmin user switch)
│
├── /submission-failures          (admin log)
├── /system-messages              (admin broadcast)
├── /archive                      (archived groups)
│
├── /admin
│   ├── /admin/server             (server management, runtime environments)
│   ├── /admin/instances          (instance list)
│   └── /admin/instances/[id]/edit
│
├── /profile                      (my profile, settings, tokens)
│
└── /[...not-found]               (404)
```

---

## 3. Navigation Model

### 3.1 Primary Navigation (Sidebar)

The sidebar is collapsible and shows _context-aware_ navigation:

| Section         | Contents                                                          | Visibility                                     |
| --------------- | ----------------------------------------------------------------- | ---------------------------------------------- |
| **Dashboard**   | Home, Calendar                                                    | Always                                         |
| **My Groups**   | All groups (the list), then groups where I am a member (any role) | Always                                         |
| **My Teaching** | Groups where I am supervisor/admin, organizational ones excluded  | Only if any exist                              |
| **Exercises**   | Exercise catalog, Pipelines                                       | `supervisor-student` and above                 |
| **People**      | My profile (always), Users (`supervisor` and above)               | Always                                         |
| **Admin**       | Server, Instances, System Messages, Archive                       | Only if `superadmin` or `empowered-supervisor` |

**Note:** "My Groups" and "My Teaching" are not mutually exclusive. A user in both sees both sections. The API returns per-group membership arrays (`admins`, `supervisors`, `observers`, `students`), and the sidebar derives visibility from those arrays, not from the global role.

### 3.2 Breadcrumb Manifest

Central manifest maps route segments to labels:

```
/groups                    → "Groups"
/groups/[groupId]          → [group name, fetched async]
/groups/[groupId]/assignments → "Assignments"
/assignments/[id]          → [assignment name, fetched async]
/solutions/[id]            → "Solution"
/exercises                 → "Exercises"
/exercises/[id]            → [exercise name, fetched async]
```

For dynamic segments, the manifest includes an async resolver that fetches the entity name from the API. This is a Server Component — no client-side waterfall.

### 3.3 PageShell

Every page uses a single `PageShell` component with props:

```typescript
interface PageShellProps {
  title: string;
  subtitle?: string;
  breadcrumbs: BreadcrumbItem[];
  actions?: React.ReactNode; // primary + secondary actions
  tabs?: React.ReactNode; // optional tab navigation
  children: React.ReactNode;
}
```

No page builds its own header. This ensures consistent layout, spacing, and responsive behavior.

### 3.4 Command Palette (Cmd+K)

A global command palette for jumping to:

- Groups (by name)
- Assignments (by name, within groups)
- Exercises (by name)
- Users (by name/email — for teachers/admins)

Data source: `/api/search` (or equivalent) with debounced queries.

---

## 4. Key Screen Designs

### 4.1 Dashboard

The dashboard is the single most important screen. It answers two questions at once:

**Student section (if any student memberships):**

- "What do I owe?" — upcoming deadlines, sorted by urgency
- "How am I doing?" — recent evaluations (passed/failed), points progress
- "What can I submit?" — assignments open for submission

**Teacher section (if any supervisor/admin memberships):**

- "What needs my attention?" — unreviewed submissions, sorted by waiting time
- "What's coming up?" — assignment deadlines (for planning)
- "Recent activity" — new submissions, comments

Both sections are visible simultaneously if applicable. No mode switch. If only one section exists, the other is hidden.

**URL state:** `?tab=student|teacher|calendar` — deep-linkable, but defaults to the most relevant view.

### 4.2 Group Detail (`/groups/[groupId]`)

Tab-based navigation within the group:

- **Info** — description, stats, announcements
- **Assignments** — list with filters (all, open, closed, w/ submissions)
- **Students** — roster, points overview, per-student drill-down
- **Exams** — exam mode management
- **Settings** — edit group, manage members, invitations

The tab state is stored in `searchParams` (`?tab=info|assignments|students|...`). No page reload on tab switch — Server Component re-render with different search params.

### 4.3 Assignment Detail (`/assignments/[id]`)

**Student view:**

- Description, deadlines, points
- "Submit solution" button (if allowed)
- My submissions list (with evaluation status)
- "View evaluation" for each submission

**Teacher view (if supervisor in this group):**

- Same as student, plus:
- "All submissions" link
- "Edit assignment" button
- Assignment stats (submitted count, average score)

### 4.4 Solution Detail (`/solutions/[id]`)

Two-column layout:

- **Left:** Evaluation result (test-by-test, compilation log, judge output)
- **Right:** Source code with inline review comments

Live evaluation progress: TanStack Query polling (or WebSocket if monitor is running) updates the left column while evaluation is running.

**Source code:** Shiki renders server-side with stable per-line node IDs. Review comments anchor to these IDs via a client-side island.

### 4.5 Exercise Config Editor (`/exercises/[id]/edit-config`)

This is the hardest screen. It combines:

- Pipeline selection (from existing pipelines)
- Variable mapping (exercise variables → pipeline inputs)
- Per-environment configuration
- Graphviz structure visualization

**Graphviz decision:** Port `viz.js` behind `next/dynamic` initially. Evaluate replacing with a JS graph layout library (e.g., `elkjs` or `d3-dag`) after parity is reached. Budget: significant.

---

## 5. Route Manifest (for Breadcrumbs)

```typescript
const routeManifest: Record<string, RouteEntry> = {
  "/": { label: "Home", public: true },
  "/login": { label: "Log in", public: true },
  "/register": { label: "Register", public: true },
  "/forgot-password": { label: "Forgot password", public: true },
  "/dashboard": { label: "Dashboard" },
  "/groups": { label: "Groups" },
  "/groups/[groupId]": {
    label: async (groupId) => fetchGroupName(groupId),
    parent: "/groups",
  },
  "/groups/[groupId]/assignments": {
    label: "Assignments",
    parent: "/groups/[groupId]",
  },
  "/assignments/[assignmentId]": {
    label: async (assignmentId) => fetchAssignmentName(assignmentId),
    parent: async (assignmentId) => fetchAssignmentGroupPath(assignmentId),
  },
  "/solutions/[solutionId]": {
    label: "Solution",
    parent: async (solutionId) => fetchSolutionAssignmentPath(solutionId),
  },
  "/exercises": { label: "Exercises" },
  "/exercises/[exerciseId]": {
    label: async (exerciseId) => fetchExerciseName(exerciseId),
    parent: "/exercises",
  },
  "/pipelines": { label: "Pipelines" },
  "/pipelines/[pipelineId]": {
    label: async (pipelineId) => fetchPipelineName(pipelineId),
    parent: "/pipelines",
  },
  "/admin": { label: "Administration" },
  "/admin/server": { label: "Server Management", parent: "/admin" },
  "/admin/instances": { label: "Instances", parent: "/admin" },
  // ... all routes in sitemap
};
```

---

## 6. State Management Strategy

| State Type                                    | Location                | Tool                               |
| --------------------------------------------- | ----------------------- | ---------------------------------- |
| **Auth**                                      | httpOnly cookie         | `proxy.ts` + Route Handlers        |
| **Server data (group, assignment, solution)** | Server Components       | `server-only` API client           |
| **Filters, tabs, pagination**                 | URL `searchParams`      | `useSearchParams` in client leaves |
| **Form state**                                | Client components       | React Hook Form + Zod              |
| **File upload progress**                      | Client components       | Local state + Route Handler        |
| **Evaluation progress**                       | Client components       | TanStack Query polling/WebSocket   |
| **Theme (dark/light)**                        | `localStorage` + cookie | `data-theme` attribute             |
| **Locale**                                    | `params.lang`           | `next-intl`                        |

---

## 7. Open Questions

| Question                              | Assumption                                                                                                                                                                                                                                 | Where Logged           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| ~~Exact CAS callback URL structure~~  | Resolved (F-019, DEC-041): `/api/auth/external/[authenticatorName]/callback`, a generic dynamic-segment route matching core-api's own `/login/{authenticatorName}`, not the CUNI-specific `/api/auth/cas/callback` originally guessed here | `DECISIONS.md` DEC-041 |
| WebSocket URL for evaluation progress | `wss://<domain>/ws` (from compose proxy)                                                                                                                                                                                                   | `QUESTIONS.md`         |
| Extension token handoff mechanism     | Investigate legacy `SIS-ext-webapp`                                                                                                                                                                                                        | `QUESTIONS.md`         |
| Markdown rendering compatibility      | Test with real exercise texts                                                                                                                                                                                                              | `QUESTIONS.md`         |
| SMTP config for email flows           | Not configured; use `mail.debugMode`                                                                                                                                                                                                       | `QUESTIONS.md`         |

---

## 8. Next Steps

1. Review this IA with operator (tagged `IA-ASSUMPTION`).
2. Build `docs/BACKLOG.md` with tickets in dependency order.
3. Scaffold the repo (Next.js 16.3, App Router, TypeScript strict).
4. Build foundation: auth, BFF, API client, layout, navigation.
5. Build design system: PageShell, DataTable, form kit, toast.
6. Implement student experience first, then teacher, then admin.
7. Parity sweep against `INVENTORY.md`.
