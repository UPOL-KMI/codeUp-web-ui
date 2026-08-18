# ReCodEx — New Web Frontend (Next.js): Agent Brief

You are building a **new frontend for ReCodEx** in a **new, empty repository**. It runs
side-by-side with the existing `ReCodEx/web-app` against the **same, unmodified API**, so the two
can be compared capability by capability.

This document is your contract. Read it fully before writing any code.

---

## 0. How to use this document

**On your first session:** read this file end to end, then create `AGENTS.md` in the new repo
containing §3 (constraints), §6 (Next.js footguns), §7 (working protocol) and §12 (code hygiene),
verbatim. `AGENTS.md` — not a tool-specific filename — because it is the convention every current
coding agent reads, and because Next.js writes its own version-matched documentation block into
that same file (see §4).

**On every later session** — you will get many, because your context will be exhausted and
restarted repeatedly — do exactly this, in order, before anything else:

1. Read `AGENTS.md`.
2. Read the last ~100 lines of `docs/PROGRESS.md`.
3. Read `docs/BACKLOG.md` and pick the top unblocked ticket.
4. Read the `docs/INVENTORY.md` rows that ticket touches.
5. Work.

That sequence must be enough to resume correctly from a cold start. If it ever isn't, the fix is to
improve what you write into those files — not to re-read the legacy source from scratch.

**Yes, there is a context window.** There is one regardless of whether you are driven from an
editor, an API token, or a chat window; the interface does not change it. Starting a fresh context
whenever the current one gets long is the correct move, and the file protocol above is what makes
it cheap. Do not try to hold the project in your head.

---

## 1. What exists

| Thing                               | Status                                                                                                            |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| ReCodEx core-api                    | Running, working. **Read-only for you — never modify it.**                                                        |
| Legacy frontend (`ReCodEx/web-app`) | Running, and checked out locally. Functional reference — this is "the spec". Read-only.                           |
| The running instance's data         | **Disposable.** See below.                                                                                        |
| docker compose (all repos)          | Exists. You add **one new service/folder** for this app. See "Integrate the same way everything else does" below. |

**Legacy stack, for context:** React 19.2, Redux Toolkit + `redux-form` + `immutable` +
`redux-storage` + `redux-promise-middleware`, `react-bootstrap` 2.10 on AdminLTE 4, `react-intl` 10
(cs/en), Webpack 5 + Babel 8 with Express SSR, `moment`, `react-ace`, `highlight.js` + `prismjs` +
`react-syntax-highlighter`, `react-diff-viewer`, `viz.js`, `markdown-it`, `prop-types`, mocha/chai,
yarn 4.

You keep **none** of that plumbing. You keep **all** of the behaviour.

### The test instance is disposable

The running instance has never been used in production and holds no real data. Therefore:

- **Create, modify and delete freely.** Make groups, assignments, exercises, submissions, users,
  reviews — whatever you need to see a screen in a realistic state. You do not need permission.
- **You still may not modify the API or any other ReCodEx repo.** Data is disposable; code is not.
- Still never commit credentials, tokens, or anything that looks like personal data.

### Build `scripts/seed.ts` in the first session, before any UI work

This is not optional and not merely "worth building" — it is how you get the test accounts the
operator is deliberately **not** supplying (see "Inputs" below). Every later screen, every E2E
journey, and every permission check you build depends on having known, reproducible test data
across every role and every group-membership combination.

**Get the permission model right before you seed anything — verify it against the API and against
`Roles.php` in the api repo, not from memory or from this paragraph.** ReCodEx has two independent
axes of "who can do what", and conflating them will produce wrong test data and wrong UI logic
later:

- **Global role**, one of `student`, `supervisor-student`, `supervisor`, `empowered-supervisor`,
  `superadmin` (hierarchical — each inherits the ones below it).
- **Per-group membership status** — independent of global role. Each group's API response carries
  its own `admins` / `supervisors` / `observers` / `students` arrays. "Group admin" is a membership
  fact about _one specific group_, not a global role. A `supervisor`-role user can be admin of one
  group and merely a plain member of a different one, in the same account, at the same time — this
  is the normal case per §2, not an edge case, and your seed data must exercise it, not just
  mention it.

The script must create, **via the public API only** — never SQL, never touching the database
directly; this also doubles as your first real exercise of the API surface you'll be building
against:

- a plain student, enrolled in at least one group, with submitted solutions spanning a mix of
  evaluation states (pending, passed, failed, and at least one assignment with nothing submitted
  yet)
- a `supervisor` who is admin of at least one group and a plain (non-admin) member of a second
- a `supervisor-student` — supervises one group, is a plain student in a different one; this is the
  §2 "one person, two audiences" case made concrete, and it must exist in the seed data
- the superadmin — **reuse the existing seeded account (`admin@admin.com`), do not create a second
  one**
- at least two groups, one containing subgroups, one archived
- enough assignments/exercises/submissions that every list/table state (empty, populated,
  paginated, "too many rows") is reachable somewhere in the seed data

**Wiping or resetting the underlying database is an operator-level action outside your reach** — it
goes through this ReCodEx deployment's own `docker compose down -v && up -d` / `db:fill` mechanism,
not through core-api's public REST surface. Do not attempt it and do not build tooling that assumes
you can. `scripts/seed.ts` is responsible only for layering known, idempotent test data on top of
whatever base state exists (which starts as just the seeded superadmin) via the public API.

Make it **idempotent**: safe to run against a freshly wiped database, and safe to run again on top
of its own previous output without duplicating everything. Check for existing records by a fixed,
recognisable naming scheme (e.g. a `[seed]` prefix on names) before creating.

Record every created account's credentials in `docs/SEED_ACCOUNTS.md` — not `.env`; these are
throwaway test credentials on a disposable instance, not secrets — so a fresh session can find them
without re-reading the script. Treat `pnpm seed` (or whatever you name it) as your reset mechanism
from here on, not a one-time bootstrap step.

### Inputs you need from the operator

If any of these are missing, write them into `docs/QUESTIONS.md`, make the most reasonable
assumption you can, record it in `docs/DECISIONS.md`, and **keep working**. Do not stop.

- API base URL of the running instance (e.g. `http://localhost:4000/v1`)
- Path to the local checkout of the legacy `web-app`
- Path to the docker compose repo, and the convention for adding a service
- Whether the instance uses external auth (CAS); if so, its config
- Port the new app should bind to

Test accounts are **not** a supplied input — you create them yourself, per "Build `scripts/seed.ts`"
above.

Put them in `.env.local` (gitignored) with a committed `.env.example`.

### Integrate the same way everything else in this deployment does

Your frontend's source lives in its own repository, as instructed above. The compose repo then gets
exactly two additions: a `services/<name>/Dockerfile` (plus whatever config it needs), and the one
new service entry covered in §3. Build context is the **compose repo's root**, not
`services/<name>/` itself — look at how the existing services are wired (they `COPY` from both
`repos/<name>/...` and `services/<name>/...` using a shared root context) before inventing your own
layout. Do not vendor your frontend's source inside the compose repo.

---

## 2. Goal

The legacy UI was built incrementally over ~8 years and shows it: inconsistent layouts, breadcrumbs
missing on many pages, navigation that assumes you already know where things live, teacher workflows
that take too many clicks.

**You are explicitly authorised to redesign the information architecture from scratch.** Do not
reproduce the old navigation. Reproduce the old _capabilities_.

Two audiences, both first-class:

- **Student** — should be able to answer "what do I have to do, by when, and how am I doing?"
  within one screen of landing. Submitting a solution and understanding an evaluation result should
  be obvious with zero training.
- **Teacher / supervisor** — high-frequency, repetitive work: reviewing solutions, setting up
  assignments, checking group progress. Optimise for clicks-per-task and bulk actions.

### These are audiences, not user types

**One person is routinely both at once.** A doctoral student takes courses and teaches them. A
supervisor in one group is a student in another. Design for that as the normal case, not an edge
case:

- The dashboard shows both "what I owe" and "what I'm responsible for", in whatever proportion the
  data warrants. A pure student never sees a teaching section; a pure teacher never sees deadlines
  of their own. Neither needs a mode switch.
- **Never partition the URL space by persona.** No `(student)` / `(teacher)` route groups. Routing
  follows _context_ — mostly the group — and what you can do inside a context comes from that
  context's permissions. See §5.
- Never ask the user "are you a student or a teacher?", and never derive UI from a global role name.
  See constraint 4 in §3.

---

## 3. Hard constraints (never violate)

1. **Do not modify the API, the legacy frontend, or any other ReCodEx repo.** All your writes go
   into the new repo, plus one compose entry. (The running instance's _data_ is fair game — §1.)

   **The compose file is a narrow, reviewed exception to "never block".** It is the one shared file
   you touch outside your own repo, and it already carries real, hard-won fixes (sandbox
   configuration, cgroup handling, a database version pin, several upstream source patches) that are
   easy to break by accident and hard to notice you've broken. So: add your service as one new,
   self-contained entry; never edit an existing service definition. Before the first commit that
   touches this file, and again any time you change it afterwards, show the operator the diff and
   wait for an explicit go-ahead **on that file specifically**. This is the one deliberate exception
   to "never block" in this brief, and it is scoped to this file alone — everything else proceeds
   without waiting, per §3's "Never block" section below.

2. **Do not invent endpoints.** Build only against what the API actually exposes. Verify via the
   API's OpenAPI/Swagger description if present; otherwise by reading the legacy `redux/modules` +
   `api` layer and observing real network traffic. If a screen needs an endpoint that doesn't
   exist, log it in `docs/QUESTIONS.md` and design around what exists.
3. **Feature parity is mandatory.** Every capability reachable in the legacy app must be reachable
   here. Rearranged, renamed, merged — fine. Dropped — only if recorded and justified in
   `docs/DROPPED.md`.
4. **Permissions come from the API, not from your assumptions.** The legacy app derives available
   actions from ACL / permission hints returned on entities. Find that mechanism, reuse it exactly.
   Never render an action the user isn't allowed to perform; never infer capability from a role
   name; never assume a user's capabilities are the same in two different groups. Enforce on the
   server too — a hidden button is not authorisation.
5. **The access token never reaches client-side JavaScript.** See §5.
6. **i18n: Czech and English, both complete, always.** No hardcoded user-facing strings, ever.
   Any new string lands in both locales in the same commit.
7. **Never leave the tree red.** `typecheck`, `lint` and `build` pass on every commit.
8. **No secrets or credentials** in the repo, in fixtures, or in screenshots.

### Never block

There is no approval gate anywhere in this document, with the single, narrow exception of the
compose file noted in constraint 1. The operator may be asleep. When you hit something you cannot
resolve:

1. Write the question and your reasoning into `docs/QUESTIONS.md`.
2. If you can proceed on an assumption, record it in `docs/DECISIONS.md`, tag the code or ticket
   with the assumption, and proceed.
3. If you genuinely cannot proceed, mark the ticket `blocked` in `docs/BACKLOG.md` with the reason
   and **move to the next unblocked ticket.**
4. Stop entirely only when every remaining ticket is blocked, or the whole thing is done.

Prefer a recorded wrong guess you can unwind over a stall. The only things worth a genuine halt are:
you would have to change the API to continue, you have discovered something that invalidates large
parts of this brief, or you are about to touch the shared compose file (constraint 1).

---

## 4. Stack

Target **Next.js 16.3.x, App Router**, on the newest patch of that line.

Context you need: on 6–7 May 2026 Vercel shipped a coordinated release patching 13 advisories
(fixed in 15.5.18 and 16.2.6); the largest single class was middleware/proxy bypass, one of which
let App Router segment-prefetch requests skip middleware-based auth checks entirely. Earlier 16.x
and 15.x minors were not backported, and Vercel has since moved to a **monthly** security release
cadence. (Reverify this advisory count and these dates against the current advisory database and
the current `next` changelog before treating them as ground truth — they are the reason to stay
paranoid about the installed version, not a fact to cite verbatim in your own docs.) So:

- `npm view next version` before scaffolding. Take the latest 16.3 patch. Never accept whatever
  version a scaffold template pins.
- Add Renovate or Dependabot on day one, with `next` and `react-server-dom-*` grouped together.
- Never downgrade to work around a bug. Fix the code or record the problem.

**Do not pin any version from memory, and do not trust your training data for Next.js APIs.**
Caching semantics, `use cache`, Server Action behaviour and file conventions have all changed
repeatedly across recent majors — including one that will silently break your auth if you get it
wrong (§6.1).

### Read the version-matched docs, not the internet

Since 16.3, running `next dev` writes and maintains a version-matched block in `AGENTS.md` pointing
at the documentation bundled in your local `node_modules`. **This is your primary reference.** It is
version-exact, offline, and free. Do not delete or reformat that block when you edit `AGENTS.md`;
write your own content around it.

Two fallbacks: appending `.md` to any `nextjs.org/docs` URL returns Markdown, which is cheaper to
read than HTML; and `/docs/llms.txt` is the docs index.

| Concern         | Choice                                                                                                                                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework       | Next.js 16.3 App Router, TypeScript `strict: true`                                                                                                                                                              |
| React           | 19. React Compiler: leave **off** initially; enable only after measuring                                                                                                                                        |
| Package manager | **pnpm.** Its strict `node_modules` catches phantom dependencies, which matters for keeping the `server-only` boundary honest, and it layers well in Docker. Legacy uses yarn — irrelevant, this is a new repo. |
| Node            | 22 LTS. Pin in `.nvmrc`, `package.json#engines`, and the Dockerfile.                                                                                                                                            |
| TypeScript      | **7.x**, so `next build` uses the native type checker. You will run `build` hundreds of times; this is a large cumulative saving.                                                                               |
| Styling         | Tailwind CSS + shadcn/ui (components vendored into the repo)                                                                                                                                                    |
| Icons           | lucide-react                                                                                                                                                                                                    |
| Auth            | httpOnly cookie + BFF — see §5                                                                                                                                                                                  |
| Server data     | Server Components fetching core-api via a typed `server-only` client                                                                                                                                            |
| Client data     | TanStack Query, **only** for genuinely client-driven cases, hitting Next Route Handlers — never core-api directly                                                                                               |
| Mutations       | Server Actions, Zod-validated on the server, then `revalidateTag` / `revalidatePath`. **Except file uploads — see §6.7.**                                                                                       |
| Complex forms   | React Hook Form + Zod (shared schema), submitting through a Server Action                                                                                                                                       |
| i18n            | **next-intl** (App Router-native, works in Server Components). Migrate the legacy cs/en messages.                                                                                                               |
| Tables          | TanStack Table, in client leaves                                                                                                                                                                                |
| Dates           | date-fns + native `Intl`. **No moment.**                                                                                                                                                                        |
| Code editor     | CodeMirror 6, client-only via `next/dynamic`                                                                                                                                                                    |
| Code display    | Shiki, rendered server-side                                                                                                                                                                                     |
| Graph rendering | See §7 — the pipeline visualiser needs a deliberate choice                                                                                                                                                      |
| Markdown        | react-markdown + remark-gfm + rehype-katex, server-side. **Compatibility risk — see §7.**                                                                                                                       |
| API types       | Generate from OpenAPI if available (`openapi-typescript`); otherwise hand-written types                                                                                                                         |
| Unit tests      | Vitest                                                                                                                                                                                                          |
| E2E             | Playwright, plus `@next/playwright` for its `instant()` helper                                                                                                                                                  |
| Lint/format     | ESLint flat config + Prettier                                                                                                                                                                                   |
| Container       | `output: 'standalone'`                                                                                                                                                                                          |

### Turn on, deliberately

- **Turbopack filesystem cache for builds.** Since 16.3, disk caching works with `next build` and
  is on by default; repeat builds read unchanged artifacts from cache. You are required to build
  before every commit (§8), so verify this is actually active.
- **Turbopack memory eviction in dev** (on by default since 16.3, up to ~90% less RAM). You will
  keep a dev server alive for many hours; without this it will eventually die of memory exhaustion
  and take your session with it. If you ever see the dev server OOM, restart it and note it in
  `PROGRESS.md` rather than assuming your code caused it.

### Leave off, deliberately

- **`cacheComponents` and `partialPrefetching`.** These are where Next.js is heading, and you may be
  tempted by a scaffold or a doc example. Leave both off. Essentially every byte in this app is
  per-user and permission-dependent; an implicit-caching feature is the wrong bet until the app
  exists. Record this in `DECISIONS.md` as a deliberate deferral, with a note to revisit for the
  static shell once parity is reached — do not let it happen by accident in either direction.
- **React Compiler** (including the experimental Rust one). Same reasoning: measure first.

### Runtime configuration

The legacy app reads runtime config from `etc/env.json`. Reproduce the _behaviour_ of these, all of
them, not just the obvious ones:

| Legacy key                                                   | What to do                                                                                                                                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API_BASE`                                                   | Server-side env var. **See the two-URL rule below.**                                                                                                                            |
| `TITLE`                                                      | Server-side env var, used in metadata                                                                                                                                           |
| `SHORT_SESSION`                                              | Not just a variable — a _behaviour_. Short sessions gate sensitive operations. Design how re-authentication works under httpOnly cookies (§5) rather than dropping it silently. |
| `ALLOW_LOCAL_REGISTRATION`                                   | Controls which registration forms exist. **This means registration flows exist — see §7.**                                                                                      |
| `EXTERNAL_AUTH_URL`, `_SERVICE_ID`, `_NAME`, `_HELPDESK_URL` | CAS. `_NAME` is a localised object. `_HELPDESK_URL` appears when CAS registration fails — a real error path, not decoration.                                                    |
| `ENVIRONMENTS_INFO_URL`                                      | Outbound link from runtime-environment UI                                                                                                                                       |
| `PERSISTENT_TOKENS_KEY_PREFIX`                               | Legacy localStorage/cookie namespacing. Your equivalent is the cookie name prefix — keep it configurable so two instances can share a domain.                                   |
| `SKIN`                                                       | AdminLTE colour. Drop it; you have a proper theme system. Record in `DROPPED.md`.                                                                                               |
| `URL_PATH_PREFIX`                                            | See below.                                                                                                                                                                      |

**Two API URLs, not one.** Inside docker, your server-side fetches reach core-api on the internal
service hostname; anything the _browser_ touches (CAS redirect targets, any WebSocket) needs the
externally reachable URL. Use two variables (`API_BASE_INTERNAL`, `API_BASE_PUBLIC`) from the start.
Conflating them is the single most common way a Next-in-compose setup works in dev and fails in the
container.

**`URL_PATH_PREFIX`:** Next's `basePath` is resolved at build time, not runtime. Support it as a
**build argument** — read it in `next.config.ts` from an env var, pass it as a Docker build arg,
document that changing it requires a rebuild. Do not pretend it is runtime-configurable and do not
silently drop it; the legacy config explicitly uses it to host multiple frontends on one domain.
Record the build-time limitation in `DROPPED.md`.

---

## 5. Auth architecture (the load-bearing decision)

The legacy app keeps a bearer JWT in localStorage. That cannot work with Server Components.

- **Login**: Route Handler receives credentials → calls core-api → stores the token in an
  **httpOnly, sameSite=lax cookie**. The token is never serialised into client HTML, never passed as
  a prop to a client component, never readable by browser JS.
- **The `secure` flag is conditional.** `secure: true` on plain `http://` means the browser drops
  the cookie and login appears to succeed while never actually logging you in — a confusing failure
  you should not spend time on. Set `secure` from the environment: on in production, off when
  serving plain HTTP locally. Write it as one helper, `sessionCookieOptions()`, used everywhere, so
  there is exactly one place this can be wrong.
- **External auth (CAS)**: the redirect callback is a Route Handler that exchanges the ticket with
  core-api and sets the same cookie. The callback URL must use the _public_ base URL. Handle the
  failure path — it has a dedicated helpdesk link in the legacy config.
- **Server-side reads**: Server Components call a `server-only` API client that pulls the token from
  `cookies()` and sets the `Authorization` header.
- **Refresh**: **you cannot set cookies during a Server Component render.** Token refresh and expiry
  handling happen in `proxy.ts` or Route Handlers only. Design for this from the start — it is the
  single most likely thing to go subtly wrong. Guard against the concurrent-refresh race: several
  in-flight requests must not each trigger a separate refresh and invalidate each other.

### Authorisation has exactly one boundary

**`proxy.ts` is not a security boundary.** Four of the thirteen May 2026 advisories were
middleware/proxy bypasses, including one where segment-prefetch requests skipped middleware auth
checks entirely. Treat `proxy.ts` as a user-experience redirect — "you look logged out, go to
/login" — and nothing more.

The **only** authorisation boundary is the server-side data access layer. Concretely:

- Every function that touches core-api calls `requireSession()` itself. Not the caller. Not the
  page. Not the layout. Itself.
- Every Server Action re-validates input with Zod and re-checks authorisation inside the action.
  A Server Action is a public HTTP endpoint that happens to have nice syntax.
- Every Route Handler does the same.
- If you find yourself writing "this is already checked upstream", you have found a bug.

### Routing follows context, not persona

Because a user's capabilities differ per group (§2), the route structure is:

```
app/
  (anon)/            login, register, password reset, CAS callback UI, verification
  (app)/             the authenticated shell — one layout
    dashboard/       personalised: what I owe + what I'm responsible for
    groups/[groupId]/…    everything group-scoped; contents driven by my permissions here
    assignments/[assignmentId]/…
    solutions/[solutionId]/…
    exercises/…      authoring
    admin/…          instance administration
    profile/…
```

What renders inside a group is a function of the permission hints the API returns for _that group_.
Not of a route group. Not of a global role.

---

## 6. Next.js-specific rules (footgun list)

These exist because they are where auth-gated App Router apps actually break. Put them in
`AGENTS.md`.

1. **`middleware.ts` does not exist. It is `proxy.ts`.** Since Next.js 16, `proxy.ts` replaces
   `middleware.ts`, the exported function is named `proxy`, it runs on the Node.js runtime, and
   config flags renamed accordingly (`skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`). If you
   write `middleware.ts` from memory you get a file that **silently never runs** — auth
   "protection" that does nothing, with no error. `middleware.ts` still technically exists as a
   deprecated Edge-runtime path; do not use it. This also affects next-intl setup, which documents
   the file by name.
2. **`params`, `searchParams`, `cookies()`, `headers()` and `draftMode()` are async.** They return
   Promises and must be awaited. This is the single most common thing to get wrong from memory.
3. **Never cache user-scoped data.** Every response from core-api is per-user and permission-
   dependent. Verify current caching defaults in the bundled docs rather than assuming, then be
   explicit. A cross-user cache leak here is a security incident, not a bug.
4. **Server Components by default.** `"use client"` goes on interactive leaves only. A `"use client"`
   on a layout or a `page.tsx` requires a justification in `DECISIONS.md`.
5. **Nothing sensitive crosses the boundary.** No token, no server-only config, no unfiltered API
   payloads passed as props into client components. Pass the fields the component needs.
6. **Hydration mismatches are errors, not warnings.** Relative times ("in 3 days"), locale- and
   timezone-dependent formatting must render client-side or use a stable absolute format on the
   server. ReCodEx is full of deadlines — this will bite otherwise.
7. **File uploads do not go through Server Actions.** Server Actions have a default request body
   limit around 1 MB. ReCodEx uploads solution archives and assignment attachments. Uploads go
   through a **Route Handler that streams to core-api**. If the legacy app chunks large uploads,
   find out and reproduce that. Discovering this while building the submission flow — the highest-
   value screen in the app — would be an expensive surprise. **The deployment's own nginx and PHP
   layers are configured for uploads up to 512 MiB (`client_max_body_size`,
   `upload_max_filesize`/`post_max_size` — check the compose repo's `services/api/` and
   `services/proxy/` configs for the current values rather than assuming). Your Route Handler and
   any reverse proxy in front of it must accommodate the same ceiling, or large solution archives
   will fail in your app in a way they don't in the legacy one.**
8. **Use `catchError` for error boundaries.** Since 16.3, `catchError` from `next/error` defines a
   custom error boundary that does not interfere with `notFound()` or `redirect()`, and provides a
   `retry()` that refetches the boundary's children including re-rendering failed Server Components.
   This is how §9's "every error state has a retry" gets implemented — not with a bespoke
   client-side retry.
9. **Every route segment gets `loading.tsx` and an error boundary**, plus designed not-found and
   forbidden states. This is how "consistent states" in §9 gets satisfied structurally rather than
   page by page.
10. **No `useEffect` data fetching.** Server Component, or TanStack Query. Nothing else.
11. **Consider `next/root-params` for the locale.** If next-intl puts you on `app/[locale]/…`, root
    params let any Server Component read the locale without prop drilling. Verify the current API
    before using it.
12. **Breadcrumbs come from one mechanism.** A central route manifest mapping segments to labels,
    including async resolvers for entity names (group, assignment, exercise). Every page renders
    breadcrumbs through it. No page builds its own.

---

## 7. Domain landmines

These are things the legacy repo proves exist and that a plausible-looking plan will otherwise miss.
Check each one explicitly.

**Live evaluation progress may be a WebSocket, not polling.** ReCodEx has an optional separate
component (`monitor`) that reports job evaluation progress in real time; it acts as a WebSocket
server that **browsers connect to directly**. Find out whether this deployment runs it (it does —
check the compose repo's `services/monitor/` and the proxy's `/ws` route for how it's currently
exposed). Then decide deliberately between it and polling, and record why. If you use it (the
existing deployment already proxies it and is the reference for how), note that a direct
browser-to-monitor connection bypasses your BFF entirely — that needs its own entry in
`DECISIONS.md` covering how the connection is authorised and which URL the browser gets (§4's
public URL).

**Registration, password reset and email verification exist.** `ALLOW_LOCAL_REGISTRATION` in the
legacy config proves it, as does the CAS-registration-failure helpdesk link. These are the only
unauthenticated routes in the product, they need their own route group, and they are easy to forget
because they never appear while you are logged in. Inventory them first. **Note: this deployment's
outbound SMTP is not configured yet, so sent emails cannot be observed end-to-end for now — build
and test the request/response side of these flows against the API regardless, log the gap in
`docs/QUESTIONS.md`, and check the API's `mail.debugMode` / `archivingDir` config (see the compose
repo's `services/api/`) as a way to inspect what would have been sent without real SMTP.**

**Solution diffing.** The legacy app ships `react-diff-viewer`. Find what it is used for —
comparing solution versions and similar — and keep the capability.

**Pipeline visualisation is a Graphviz render.** The legacy app ships `viz.js` (Graphviz compiled to
WASM) for the exercise configuration editor. That is a large client-only payload sitting inside the
screen you already know is the hardest in the product. Decide early: port viz.js behind
`next/dynamic`, or render graphs server-side, or replace with a JS graph layout. Budget for it.

**Markdown is not a free swap.** Exercise texts are authored content already in the database,
written against `markdown-it` + `@iktakahiro/markdown-it-katex`. Moving to remark/rehype will change
raw-HTML handling, KaTeX delimiters and table edge cases. Render a sample of real exercise texts
both ways early and log the differences; do not discover them during parity sweep.

**Third-party extensions.** The project supports external extensions (there is a separate
`SIS-ext-webapp` repo, and the legacy app added generic extension support). Extensions are handed a
token — which directly conflicts with §5's "the token never reaches client JS". Do not silently drop
this and do not silently hand out a token. Investigate, write up the options in `QUESTIONS.md`, and
implement the most conservative thing that preserves the capability.

**Also present, easy to miss:** the QR-code-of-current-page in the header dropdown; archived and
organisational groups; group invitations; nested subgroups; points exports; attempt limits;
per-environment assignment settings; success-exit-code configuration; judge log display; the
deprecated SIS integration page.

**License.** Legacy is MIT. Ship a matching `LICENSE` and attribute the original project.

---

## 8. Verification policy

The point is to stop you from silently drifting — marking screens "done" that don't render. It is
**not** to build a test suite.

**Before every commit:**

```
pnpm typecheck && pnpm lint && pnpm build
```

The build is doubly important: server/client boundary violations and serialisation errors surface at
build time, not in dev. With TypeScript 7 and the Turbopack build cache (§4) this is fast enough to
run this often.

**The main safety net — a Playwright smoke harness, built early:**

- Logs in as each test account from `docs/SEED_ACCOUNTS.md` (§1) against the real local API
- Visits every route implemented so far
- Fails on: any uncaught error, console error, rendered error boundary, **hydration mismatch**, or
  unexpected 4xx/5xx
- Screenshots each route to `screenshots/` (gitignored)
- Runs on affected routes after each ticket; in full whenever you finish a coherent area

**~10 core journeys as real E2E tests, and only these:**

1. Student: log in → dashboard → group → assignment detail
2. Student: upload a solution → see it evaluated → open the evaluation detail
3. Student: points, deadlines, attempt limits, received review comments
4. Teacher: group detail → student list → points overview
5. Teacher: create an assignment from an exercise → deadlines/points → publish
6. Teacher: open a submitted solution → leave review comments → close the review
7. Teacher: assignment stats / who submitted what
8. Admin: exercise list → exercise detail/config
9. Admin: users / groups / instance administration entry points
10. Anonymous: registration and password reset render and validate; locale switch cs↔en on a
    data-heavy page; unauthorised route renders a proper 403

Because the instance is disposable (§1), these tests create real data. Do that freely. Prefer
creating what you need over depending on what happens to be there — `scripts/seed.ts` should already
cover most of it.

**One security test, non-negotiable:** assert that the auth cookie is httpOnly and that the raw
token appears nowhere in the served HTML or client bundles.

**Unit tests (Vitest): only for pure logic you wrote** — deadline and points arithmetic, permission
helpers, formatting, sorting/filtering predicates, response normalisers, Zod schemas. That is the
whole list.

**Explicitly forbidden — do not spend time on:** snapshot tests; unit tests for presentational
components; testing library-provided behaviour; coverage targets; porting the legacy mocha suite;
mocking the API in E2E (you have a real one).

**Repair budget.** If a check fails, fix the cause. But bound it: **three serious attempts, or
roughly 45 minutes on one failure, whichever comes first.** Then revert the ticket's changes, mark
it `blocked` in `BACKLOG.md` with what you tried and what you observed, and move on. Reverting is
allowed and expected. Deleting or skipping a test to make the run green is not, ever.

---

## 9. UX requirements

**Structural**

- **Breadcrumbs on every page below the top level**, from the central route manifest (§6.12). This
  is a named complaint about the legacy app.
- One `PageShell`: breadcrumbs, title, subtitle, primary/secondary actions, optional tabs. Every
  page uses it. No bespoke page headers.
- Navigation reflects how people work — group-centric, deadline-forward — not the shape of the
  database, and not the user's persona (§2).
- Deep-linkable everything: filters, tabs, pagination, sort in `searchParams`.
- URLs may differ from legacy; keep them readable and stable, record old→new in `docs/ROUTES.md`.

**Consistency**

- Every list/table state is designed: loading (skeletons via `loading.tsx`, not a spinner in the
  void), empty (with the action that fills it), error (with retry, via `catchError` — §6.8),
  forbidden, and "too many rows".
- One date format, one relative-time format, one points/percentage format — shared helpers.
- One toast system; every mutation reports success and failure. No silent failures, ever.
- Destructive actions confirm; long operations show progress.

**Quality bar**

- Keyboard navigable throughout; visible focus; Radix primitives for anything with focus semantics.
- Command palette (Cmd/Ctrl-K) for jumping to groups, assignments, users.
- Responsive to phone width — students check deadlines on phones.
- Dark mode via tokens from day one; never hardcode a colour.
- Respect `prefers-reduced-motion`. No layout shift on data load.

**Domain-specific care** — these carry ReCodEx's real complexity and are where the legacy UI is
weakest:

- The **exercise configuration editor** (pipelines, variables, environments, hardware groups) — the
  hardest screen in the product, heavily interactive, a client-component island by necessity, and
  containing the Graphviz problem from §7. Study it thoroughly before redesigning.
- **Evaluation results**: test-by-test results, compilation logs, judge output, resource limits,
  success exit codes. A student must understand _why_ they failed at a glance. Evaluation is
  asynchronous — see §7 on how progress actually arrives.
- **Solution review**: inline comments anchored to source lines, review open/close lifecycle. Note
  the tension: Shiki renders server-side, but per-line comment anchors and interaction are
  client-side. Decide the anchoring approach (Shiki transformers emitting stable per-line nodes, or
  similar) **once, up front**, not improvised inside the review screen.
- **Assignment setup**: first/second deadlines, points before/after, thresholds, attempt limits,
  visibility, per-environment settings — dense and error-prone; make consequences legible.
- **Group hierarchy**: nested subgroups, membership, invitations, archived/organisational groups.
- Points overview tables and exports.

**One code highlighter for display, one editor.** Shiki renders code you read; CodeMirror 6 handles
code you edit and brings its own highlighting. That is the complete list — no third.

---

## 10. Build order and work management

There are no phases with gates. There is a dependency order and a ticket queue.

### The queue

`docs/BACKLOG.md` holds tickets. Each ticket is one screen or one coherent capability, with: an id,
a title, the `INVENTORY.md` rows it closes, status (`todo` / `doing` / `done` / `blocked`), and for
blocked ones, why.

You create tickets yourself as you learn what the app contains. Expect the backlog to grow during
recon and shrink afterwards. Keep tickets small enough that one is a sensible unit of work in a
single context.

### The loop

1. Read the tail of `PROGRESS.md`; take the top unblocked ticket; mark it `doing`.
2. Read the relevant `INVENTORY.md` rows and the legacy source for that capability.
3. Implement.
4. Verify (§8).
5. Append to `PROGRESS.md`: timestamp, ticket, what you did, what you verified, anything surprising,
   and an `Observations` line if you noticed something worth telling the operator later (§13).
6. Update `INVENTORY.md` and `BACKLOG.md`. Commit.

Never refactor outside the current ticket. Log unrelated rot as a new low-priority ticket.

The `PROGRESS.md` append in step 5 **is** the heartbeat — you do not need a separate mechanism. It
gives the operator a timestamped trail they can read from the bottom to see exactly where things
stand and whether anything stalled.

### Dependency order

Not gates — just what unblocks what.

1. **Recon.** Enumerate the legacy app's capabilities into `docs/INVENTORY.md`: route, purpose, who
   can reach it, API calls, quirks, planned destination in the new IA, status. Discover the API
   surface. Sketch the information architecture into `docs/IA.md` — sitemap, navigation model,
   reasoning. Post `IA.md` where the operator will see it, then **keep going on the assumption it is
   accepted**; tag decisions that depend on it as `IA-ASSUMPTION` so a later objection is cheap to
   unwind.

2. **Foundation.** Repo, tooling, strict TS, ESLint/Prettier, Dockerfile (`standalone`), compose
   entry, CI. The **auth/BFF layer end to end**: login, cookie, `proxy.ts`, refresh, CAS callback,
   logout, route protection, data access layer with `requireSession()`. Typed `server-only` API
   client with error normalisation. next-intl with cs/en. Theme tokens. Route skeleton with layouts.
   Error/not-found/forbidden conventions. Playwright harness against the real API, including the
   token-leakage test. `scripts/seed.ts` (§1) — build this before, or alongside, the rest of
   Foundation, not after; almost everything downstream needs the accounts it creates.

3. **Design system.** PageShell + breadcrumb manifest, DataTable (sort/filter/paginate/URL
   sync/bulk select), form kit on Server Actions (field, error surfacing, pending state, dirty
   guard), upload component using the Route Handler path (§6.7), dialogs, toasts, state components,
   code viewer with line anchoring, Markdown renderer, status badges, formatters. Expose everything
   on an internal `/dev/kitchen-sink` route — cheaper and more useful here than Storybook.

4. **Student experience first** (highest value): dashboard, groups, assignment detail, submission
   flow, evaluation results with live progress, points and progress, received reviews, profile.
   Then **anonymous flows** (registration, password reset, verification) — small and easy to forget.

5. **Teacher / supervisor.** Group management, roster, assignment creation and editing, exercise
   selection, solution review workflow, stats, points overview, exports, deadlines and limits.

6. **Exercise authoring & admin.** Exercise catalogue and editing, reference solutions,
   configuration editor, pipelines, instances, users, system administration.

7. **Parity sweep & polish.** Walk `INVENTORY.md` top to bottom against the running legacy app;
   close gaps. Accessibility pass. Performance pass (bundle size, request waterfalls, over-fetching
   in layouts). Full cs/en review. README, deployment notes, `ROUTES.md`, `DROPPED.md`.

8. **Retrospective** (§13).

### On comparing against the legacy app

**Source code is your primary reference, not screenshots.** You have the whole legacy repo; it is
the complete and unambiguous statement of what the app does, including the modals, popovers,
permission-gated buttons, empty states and error paths that a screenshot cannot show. Extract
capabilities from the source into `INVENTORY.md` and treat that file as the parity contract.

Screenshot the running app only when the source leaves the _behaviour_ genuinely unclear, or when
you need to see how something is arranged before deciding where it goes. Screenshotting every
screen up front is a poor trade — it is the most context-expensive thing you can do, it captures
only the default state of each screen, and since the IA is being redesigned there is often no
one-to-one screen to compare against anyway.

The thing that must not happen is **losing a capability**. That risk lives in `INVENTORY.md`, not in
an image folder.

---

## 11. State lives in the repo, not in your context

Your context will end and restart many times. Maintain from the first session:

- **`docs/INVENTORY.md`** — the parity contract. Every legacy capability, its destination, its
  status. Build it once, then consult it instead of re-reading the legacy source every ticket.
- **`docs/BACKLOG.md`** — the ticket queue (§10).
- **`docs/PROGRESS.md`** — append-only, timestamped. Written so a fresh session reading only the
  tail can continue correctly.
- **`docs/DECISIONS.md`** — what, why, what else you considered. Every assumption you proceeded on.
- **`docs/IA.md`**, **`docs/QUESTIONS.md`**, **`docs/DROPPED.md`**, **`docs/ROUTES.md`**,
  **`docs/SEED_ACCOUNTS.md`** (§1).

### Git

Use git however suits you — this repo will be properly versioned later, by humans, after you are
done. No branch or message conventions are imposed.

One thing is not optional, for your own sake: **commit often, and never rewrite history.** Every
commit is a restart point if a session dies mid-ticket, and the log is a second record of what
happened. Commit even when abandoning a ticket — an abandoned attempt on disk is worth more than a
clean tree and no memory of what you tried. Do not run git commands in any other ReCodEx repo.

---

## 12. Code hygiene

**Documentation goes in `docs/`. Not in the code.**

- No narrative comments. No comments restating what the line does. No `// Phase 3` or
  `// as per brief §6`. No commented-out code.
- No `TODO` / `FIXME` left behind. If something is unfinished, it is a ticket in `BACKLOG.md`.
- Comments are for non-obvious _why_: a workaround for a specific API quirk, an ordering constraint
  that isn't visible locally, a deliberate deviation. One or two lines. If you need a paragraph, it
  belongs in `DECISIONS.md` and the code gets a one-line pointer at most.
- No changelog blocks, banner comments, or authorship headers in files.
- Do not narrate your process anywhere in the source tree.

The test: would a competent developer reading this file in six months, who has never seen this
brief, find the comment useful? If not, delete it.

---

## 13. Final deliverable: the retrospective

When everything else is done, write `docs/RETROSPECTIVE.md`. You will have touched every part of
this product, and that vantage point is worth capturing.

**Write it from your notes, not from memory.** Every section draws on `PROGRESS.md` (including the
`Observations` lines from §10), `DECISIONS.md`, `QUESTIONS.md` and `DROPPED.md`. **Each claim cites
the entry it came from.** A retrospective written from a compacted context without citations is
generic and worthless; the citation requirement is what forces it to be specific.

Sections:

1. **API change requests.** Every place the API's shape forced awkward UI, an extra round trip, a
   workaround, or a dropped capability. Concrete and specific — endpoint, problem, what would fix
   it. This is likely the most valuable thing you produce for the ReCodEx team, because it is the
   only part they cannot get from reading the code.
2. **Where the build was hardest.** The tickets that took longest or failed most, and why. Anything
   that got blocked and why.
3. **Weak spots in what you built.** The parts you are least confident in, the shortcuts you took,
   the places you'd rewrite. Be specific and unflattering; this is more useful than a summary of
   what works.
4. **Where the legacy app is still better.** Be honest. Eight years of accumulated fixes encode real
   requirements, and some of them will not have survived the redesign.
5. **What a human should check first.** What you could not verify yourself — visual judgement, Czech
   copy quality, real-world workflows, anything where the test instance's synthetic data isn't
   representative.
6. **What to build next.** Ranked, with reasoning.

---

## 14. Definition of done

- Every `INVENTORY.md` row is `done` or `dropped` with a recorded reason.
- Smoke harness green across all accounts and routes; the 10 journeys pass; token-leakage test
  passes.
- `typecheck`, `lint`, `build` clean. No `TODO`/`FIXME` in the tree.
- Czech and English complete, no hardcoded strings.
- Builds and runs in docker compose alongside the legacy frontend against the same API.
- `docs/` accurate and current: INVENTORY, BACKLOG, PROGRESS, DECISIONS, IA, ROUTES, DROPPED,
  QUESTIONS, SEED_ACCOUNTS, RETROSPECTIVE.
- A fresh developer can clone, install, `pnpm dev`, and be productive from the README alone.

---

## 15. Start here

Begin recon now. Do not scaffold anything until `INVENTORY.md` and `IA.md` exist in draft.

Your first output: a short note listing anything from §1 you're missing and what you're assuming
instead, plus your recon plan. Then start working — do not wait for a reply.
