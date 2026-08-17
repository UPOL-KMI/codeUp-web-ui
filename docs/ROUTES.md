# ReCodEx New Frontend — Route Mapping (Old → New)

**Status:** Draft
**Date:** 2026-05-11
**Purpose:** Track route changes for redirect planning and user communication

---

## Public Routes

| Old Route | New Route | Change | Notes |
|---|---|---|---|
| `/` | `/` | None | Home page |
| `/faq` | `/faq` | None | FAQ page |
| `/login/:redirect?` | `/login` | **Redirect param moved to `searchParams`** | `/login/dashboard` → `/login?redirect=/dashboard` |
| `/registration` | `/register` | **Renamed** | Cleaner URL |
| `/forgotten-password` | `/forgot-password` | **Hyphenated** | Consistent with URL conventions |
| `/forgotten-password/change` | `/forgot-password/change` | **Hyphenated** | Consistent with URL conventions |
| `/email-verification` | `/email-verification` | None | — |
| `/accept-invitation` | `/accept-invitation` | None | — |
| `/accept-group-invitation/:invitationId` | `/accept-group-invitation/[invitationId]` | **Path segment naming** | Next.js dynamic route convention |

---

## Authenticated Routes

### Dashboard

| Old Route | New Route | Change | Notes |
|---|---|---|---|
| `/app` | `/dashboard` | **Renamed** | More descriptive than `/app` |

### Groups

| Old Route | New Route | Change | Notes |
|---|---|---|---|
| `/app/group/:groupId/info` | `/groups/[groupId]/info` | **Removed `/app` prefix** | Cleaner, consistent |
| `/app/group/:groupId/assignments` | `/groups/[groupId]/assignments` | **Removed `/app` prefix** | — |
| `/app/group/:groupId/students` | `/groups/[groupId]/students` | **Removed `/app` prefix** | — |
| `/app/group/:groupId/exams` | `/groups/[groupId]/exams` | **Removed `/app` prefix** | — |
| `/app/group/:groupId/exams/:examId` | `/groups/[groupId]/exams/[examId]` | **Removed `/app` prefix** | — |
| `/app/group/:groupId/user/:userId` | `/groups/[groupId]/users/[userId]` | **Removed `/app` prefix, pluralized** | Consistent with `/users` |
| `/app/group/:groupId/edit` | `/groups/[groupId]/edit` | **Removed `/app` prefix** | — |
| `/app/archive` | `/archive` | **Removed `/app` prefix** | Top-level archive view |

### Assignments

| Old Route | New Route | Change | Notes |
|---|---|---|---|
| `/app/assignment/:assignmentId` | `/assignments/[assignmentId]` | **Removed `/app` prefix, pluralized** | Consistent with `/groups`, `/exercises` |
| `/app/assignment/:assignmentId/user/:userId` | `/assignments/[assignmentId]/users/[userId]` | **Removed `/app` prefix, pluralized** | — |
| `/app/assignment/:assignmentId/edit` | `/assignments/[assignmentId]/edit` | **Removed `/app` prefix** | — |
| `/app/assignment/:assignmentId/solutions` | `/assignments/[assignmentId]/solutions` | **Removed `/app` prefix** | — |

### Solutions

| Old Route | New Route | Change | Notes |
|---|---|---|---|
| `/app/assignment/:assignmentId/solution/:solutionId` | `/solutions/[solutionId]` | **Removed assignment context** | Solutions are first-class entities; assignment context is derivable via API |
| `/app/assignment/:assignmentId/solution/:solutionId/sources` | `/solutions/[solutionId]/sources` | **Removed assignment context** | — |
| `/app/assignment/:assignmentId/solution/:solutionId/diff/:secondSolutionId` | `/solutions/[solutionId]/diff/[secondSolutionId]` | **Removed assignment context** | — |
| `/app/assignment/:assignmentId/solution/:solutionId/plagiarisms` | `/solutions/[solutionId]/plagiarisms` | **Removed assignment context** | — |

### Shadow Assignments

| Old Route | New Route | Change | Notes |
|---|---|---|---|
| `/app/shadow-assignment/:shadowId` | `/shadow-assignments/[shadowId]` | **Removed `/app` prefix, pluralized, hyphenated** | — |
| `/app/shadow-assignment/:shadowId/edit` | `/shadow-assignments/[shadowId]/edit` | **Removed `/app` prefix** | — |

### Exercises

| Old Route | New Route | Change | Notes |
|---|---|---|---|
| `/app/exercises` | `/exercises` | **Removed `/app` prefix** | — |
| `/app/exercises/:exerciseId` | `/exercises/[exerciseId]` | **Removed `/app` prefix** | — |
| `/app/exercises/:exerciseId/edit` | `/exercises/[exerciseId]/edit` | **Removed `/app` prefix** | — |
| `/app/exercises/:exerciseId/assignments` | `/exercises/[exerciseId]/assignments` | **Removed `/app` prefix** | — |
| `/app/exercises/:exerciseId/reference-solutions` | `/exercises/[exerciseId]/reference-solutions` | **Removed `/app` prefix** | — |
| `/app/exercises/:exerciseId/edit-config` | `/exercises/[exerciseId]/edit-config` | **Removed `/app` prefix** | — |
| `/app/exercises/:exerciseId/edit-limits` | `/exercises/[exerciseId]/edit-limits` | **Removed `/app` prefix** | — |
| `/app/exercises/:exerciseId/reference-solution/:referenceSolutionId` | `/reference-solutions/[referenceSolutionId]` | **Removed `/app` prefix, removed exercise context** | Reference solutions are first-class entities |

### Pipelines

| Old Route | New Route | Change | Notes |
|---|---|---|---|
| `/app/pipelines` | `/pipelines` | **Removed `/app` prefix** | — |
| `/app/pipelines/:pipelineId` | `/pipelines/[pipelineId]` | **Removed `/app` prefix** | — |
| `/app/pipelines/:pipelineId/edit` | `/pipelines/[pipelineId]/edit` | **Removed `/app` prefix** | — |
| `/app/pipelines/:pipelineId/edit-struct` | `/pipelines/[pipelineId]/edit-struct` | **Removed `/app` prefix** | — |

### Users

| Old Route | New Route | Change | Notes |
|---|---|---|---|
| `/app/users` | `/users` | **Removed `/app` prefix** | — |
| `/app/user/:userId` | `/users/[userId]` | **Removed `/app` prefix, pluralized** | — |
| `/app/user/:userId/edit` | `/users/[userId]/edit` | **Removed `/app` prefix** | — |

### Admin

| Old Route | New Route | Change | Notes |
|---|---|---|---|
| `/app/submission-failures` | `/submission-failures` | **Removed `/app` prefix** | Top-level diagnostic view |
| `/app/system-messages` | `/system-messages` | **Removed `/app` prefix** | Top-level admin view |
| `/app/server` | `/admin/server` | **Moved to `/admin` namespace** | Clearer admin separation |
| `/admin/instances` | `/admin/instances` | None | Already correct |
| `/admin/instances/:instanceId/edit` | `/admin/instances/[instanceId]/edit` | None | — |
| `/app/instance/:instanceId` | `/instances/[instanceId]` | **Removed `/app` prefix** | Instance detail view |

---

## Special Routes

| Old Route | New Route | Change | Notes |
|---|---|---|---|
| `*` (NotFound) | `/[...not-found]` | Next.js catch-all convention | — |

---

## Route Naming Conventions

The new routes follow these rules:

1. **Plural nouns for collections:** `/groups`, `/assignments`, `/exercises`, `/pipelines`, `/users`
2. **Singular for entities:** `/group/[id]`, `/assignment/[id]` → but we use plural for consistency: `/groups/[id]`, `/assignments/[id]`
3. **Hyphenated multi-word:** `/forgot-password`, `/shadow-assignments`, `/reference-solutions`, `/edit-config`
4. **No `/app` prefix:** The root path is the app. `/app` added no semantic value.
5. **Admin namespace:** `/admin/*` for instance administration, separate from group/assignment context
6. **Next.js dynamic segments:** Square brackets for path parameters (`[groupId]` instead of `:groupId`)

---

## Redirect Strategy

These redirects should be implemented (either in `next.config.ts` `redirects()` or in a Route Handler) to preserve bookmarks and external links:

```typescript
// next.config.ts redirects()
{
  source: '/app/:path*',
  destination: '/:path*',
  permanent: true,
},
{
  source: '/registration',
  destination: '/register',
  permanent: true,
},
{
  source: '/forgotten-password/:path*',
  destination: '/forgot-password/:path*',
  permanent: true,
},
{
  source: '/app/shadow-assignment/:shadowId',
  destination: '/shadow-assignments/:shadowId',
  permanent: true,
},
// ... etc for all renamed routes
```

**Note:** `/app` → `/` redirects are safe because `/app` is not a valid entity ID in ReCodEx.

---

## Open Questions

| # | Question | Where Logged |
|---|---|---|
| R-001 | Should redirects be handled in `next.config.ts` or in a Route Handler for more control? | `DECISIONS.md` |
| R-002 | Are there any legacy routes not in `routes.js` (e.g., API-linked email routes)? | `QUESTIONS.md` Q-004 |
| R-003 | Should `/login/:redirect?` redirects be preserved or simplified to `/login?redirect=...`? | **Decision made:** Use `searchParams` (cleaner) |