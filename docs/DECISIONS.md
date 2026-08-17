# ReCodEx New Frontend — Design Decisions

**Status:** Living document
**Date:** 2026-05-11

---

## Architecture

| # | Decision | Rationale | Alternatives Considered |
|---|---|---|---|
| DEC-001 | **Next.js 16.3 App Router** | Required by brief. Server Components native. App Router is the future of Next.js. | Next.js 15 (older), Remix, SvelteKit |
| DEC-002 | **TypeScript strict mode** | Catch errors at build time, not runtime. Brief requirement. | Loose TS (faster, less safe) |
| DEC-003 | **pnpm over yarn/npm** | Strict `node_modules` catches phantom deps. Better Docker layer caching. Brief requirement. | yarn (legacy uses it), npm |
| DEC-004 | **Tailwind CSS + shadcn/ui** | Modern, utility-first. shadcn/ui provides accessible primitives. Vendored into repo for full control. | CSS Modules, styled-components, Chakra UI |
| DEC-005 | **Server Components by default** | Brief §6.4: `"use client"` on interactive leaves only. Reduces client bundle. | Client-heavy SPA (legacy approach) |
| DEC-006 | **httpOnly cookie + BFF for auth** | Brief §5: token never reaches client JS. SameSite=lax for CSRF protection. | localStorage (legacy — insecure), sessionStorage |
| DEC-007 | **Two API URLs (internal + public)** | Brief §4: separate URLs for server-side fetches and browser-facing redirects. | Single URL (breaks in container) |
| DEC-008 | **Next-intl for i18n** | App Router-native, works in Server Components. cs/en both required. | react-intl (legacy), i18next |
| DEC-009 | **TanStack Query for client data** | Brief §4: only for genuinely client-driven cases. Caching, deduplication, background refetch. | SWR, Apollo Client, raw fetch |
| DEC-010 | **Server Actions for mutations** | Brief §4: Zod-validated, revalidateTag/Path. Public HTTP endpoint with nice syntax. | API Routes, tRPC |
| DEC-011 | **Route Handlers for file uploads** | Brief §6.7: Server Actions have 1MB body limit. Route Handlers stream to core-api. | Server Actions (insufficient), direct browser-to-API (breaks auth) |
| DEC-012 | **Shiki for code display** | Server-side rendering, no client JS. Better than highlight.js/prism. | highlight.js (legacy), prismjs |
| DEC-013 | **CodeMirror 6 for editing** | Modern, accessible, extensible. Client-only via `next/dynamic`. | Ace Editor (legacy), Monaco |
| DEC-014 | **React markdown + remark-gfm + rehype-katex** | Modern, maintained. Must test compatibility with legacy markdown-it. | markdown-it (legacy), MDX |

---

## IA & Routing

| # | Decision | Rationale | Alternatives Considered |
|---|---|---|---|
| DEC-015 | **No persona route groups** | Brief §2: one person is routinely both student and teacher. Routing follows context (group), not global role. | `(student)` / `(teacher)` route groups |
| DEC-016 | **Dashboard as landing page** | Brief §2: "what do I owe, what am I responsible for" on one screen. No unnecessary clicks. | Legacy home page → dashboard redirect |
| DEC-017 | **Group-centric navigation** | Brief §9: navigation reflects how people work, not database shape. Groups are the primary context. | Exercise-centric, user-centric |
| DEC-018 | **Central breadcrumb manifest** | Brief §6.12: breadcrumbs from one mechanism, async resolvers for entity names. | Per-page breadcrumbs (inconsistent) |
| DEC-019 | **Deep-linkable searchParams** | Brief §9: filters, tabs, pagination, sort in URL. Shareable state. | Local state only (lost on refresh) |
| DEC-020 | **`/dev/kitchen-sink` route** | Brief §10: cheaper than Storybook for internal component showcase. | Storybook (heavier, separate build) |

---

## State & Data

| # | Decision | Rationale | Alternatives Considered |
|---|---|---|---|
| DEC-021 | **No client-side auth state** | Auth state lives in httpOnly cookie. Server Components read from `cookies()`. Client components never see the token. | Redux auth state (legacy), Context API |
| DEC-022 | **`requireSession()` on every data access** | Brief §5: authorisation boundary is the data access layer, not the page or layout. | Middleware-only auth (insecure — §6.1) |
| DEC-023 | **Server Actions for simple mutations** | Login, logout, form submissions. Zod-validated on server. | API Routes (more boilerplate) |
| DEC-024 | **TanStack Query for live data** | Evaluation progress, notifications. Polling or WebSocket-backed query. | setInterval polling (no deduplication) |
| DEC-025 | **URL state for UI preferences** | Tab, filter, sort, page in `searchParams`. Survives refresh, shareable. | LocalStorage (not shareable), sessionStorage |
| DEC-026 | **`Dockerfile` lives in this repo's own root, not the compose repo's `services/<name>/`** | The `services/<name>` pattern the other ReCodEx components use exists because their source is pulled by the compose repo's `pull-repos.sh` from `github.com/ReCodEx/*` into a shared build context. This repo isn't one of those — it's this project's own separate repo. A self-contained Dockerfile (standard practice for a standalone Next.js app) is simpler and doesn't force an artificial cross-repo COPY. The compose entry (F-004) will point its `build.context` at this repo's path instead of the compose repo root. | Mirroring `services/<name>/` anyway (rejected — adds a COPY indirection for no benefit, since there's no upstream-pull step to share) |
| DEC-027 | **`outputFileTracingRoot` + `outputFileTracingIncludes` in `next.config.ts`** | Next's standalone-output file tracer (NFT) under-includes `@swc/helpers` with this pnpm layout — copies `cjs/` but not `esm/`, which `next`'s own `require-hook.js` needs at runtime. Diagnosed by actually running the built image (`docker run`), reading the crash, and diffing the traced output against the full pnpm store — not guessed from a GitHub issue. `outputFileTracingRoot` alone (the fix suggested for the superficially-similar "monorepo symlink" issue) did **not** fix it; `outputFileTracingIncludes: { "/**": [".../@swc/helpers/**"] }` did. Kept both — the root is harmless/recommended regardless. | `node-linker: hoisted` in `pnpm-workspace.yaml` (rejected — defeats DEC-003's strict-`node_modules` rationale for phantom-dependency detection); manually copying the missing directory in the Dockerfile as a `RUN cp` step (rejected — `next.config.ts` is the correct layer, not a build-script patch) |
| DEC-028 | **`web-next` compose service publishes its own host port directly, bypassing `proxy`** | F-004. Operator approved this shape as shown, unedited. Simpler for side-by-side dev against the legacy `web-app` (still on `:8080` behind `proxy` on `:80`) — no `nginx.conf.template` changes needed, no risk to the working legacy path while this app is still pre-parity. Container's internal `PORT` is `3000` (matches `.env.local`/Dockerfile default); host mapping is `WEB_NEXT_PORT=3001` — `3000` was already bound by something else on the host, discovered live at `docker compose up -d` and switched without further operator round-trip (recorded here, not asked about, since it's a pure host-port renumbering with zero behavioural difference). `API_BASE_INTERNAL` changed from equal-to-public (F-006's placeholder, see PROGRESS.md) to the real internal hostname `http://api:80/v1`, now that the container is genuinely on the `recodex` network — verified reachable via `docker exec ... getent hosts api`. | Routing `web-next` through `proxy` on a subpath (e.g. `/next/`) instead (rejected for now — adds `nginx.conf.template` risk to a working legacy deployment for no benefit while this app is pre-parity; revisit once cutover is closer) |

---

## Deferred

| # | Decision | Reason for Deferral | Revisit When |
|---|---|---|---|
| DEF-001 | **`cacheComponents` and `partialPrefetching`** | Brief §4: essentially every byte is per-user and permission-dependent. Implicit caching is wrong bet until app exists. | After parity is reached, static shell identified |
| DEF-002 | **React Compiler** | Brief §4: measure first. Enable only after profiling shows benefit. | After performance baseline established |
| DEF-003 | **Graphviz rendering approach** | Brief §7: decide early but budget significant time. Port viz.js initially, evaluate alternatives. | After pipeline editor is functional |
| DEF-004 | **WebSocket for evaluation progress** | Brief §7: decide after checking compose repo. Polling is simpler, WebSocket is real-time. | After monitor service configuration confirmed |
| DEF-005 | **Extension token handoff** | Brief §7: investigate, don't silently drop or hand out token. | After SIS-ext-webapp mechanism understood |

---

## Dropped

| # | Item | Reason |
|---|---|---|
| DROP-001 | **SKIN config** | AdminLTE color skin. Replaced by proper Tailwind dark/light theme. Recorded in `DROPPED.md`. |
| DROP-002 | **Redux, redux-form, immutable** | Legacy state management. Replaced by Server Components, Server Actions, React Hook Form. |
| DROP-003 | **moment.js** | Deprecated. Replaced by `date-fns` + native `Intl`. |
| DROP-004 | **moment-timezone** | Replaced by server-side absolute dates + client-side relative formatting. |
| DROP-005 | **Webpack/Babel** | Replaced by Next.js built-in Turbopack. No custom build config needed. |

---

## Assumptions (Tagged `IA-ASSUMPTION`)

| # | Assumption | Where Used | If Wrong |
|---|---|---|---|
| ASS-002 | New app binds to port `3000` | Dockerfile, compose | Update `PORT` env and compose port mapping |
| ASS-004 | Single instance deployment | Auth BFF, `instanceId` handling | Add instance selector to login flow |
| ASS-007 | File upload limit is 512 MiB | Upload Route Handler | Adjust `client_max_body_size` in proxy |
| ASS-008 | SMTP not configured, use `mail.debugMode` | Registration/password reset flows | Configure real SMTP, test end-to-end |

**ASS-001, ASS-003, ASS-005, ASS-006 were wrong** and are removed from this table rather than
corrected in place — see `QUESTIONS.md`'s Resolved section (Q-001, Q-004, Q-006, Q-010) for the
actual verified values. Removing rather than editing keeps this table honest about what was
*assumed and risky* versus *known*; the "If Wrong" column already did its job for these four.

**Process note:** all four were guesses about *this specific running deployment* (its public URL,
its CAS config, its monitor wiring, its API-doc exposure) that `ReCOdex/.env` and
`ReCOdex/docker-compose.yaml` answer directly — no guessing needed. Recon read the legacy
*application source* thoroughly but not the *deployment* this app is meant to run alongside. Both
count as "the compose repo" per §1's inputs list, and both need reading before an environment
assumption goes in this table.