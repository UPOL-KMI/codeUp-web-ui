# AGENTS.md

This file is read first, every session. See `nextjs-frontend-agent-brief.md` for the full contract
this project runs on; what follows is reproduced verbatim from it (§3, §6, §7, §12) because those
are the sections that most directly govern how you write code here, day to day.

Session start sequence (brief §0): read this file, then the last ~100 lines of `docs/PROGRESS.md`,
then `docs/BACKLOG.md` for the top unblocked ticket, then the `docs/INVENTORY.md` rows it touches.
Then work.

**Where this repo is checked out relative to the compose repo (DEC-052, 2026-08-20):** this repo
still lives in its own separate git repository (`git@github.com:jurja00/codeUp-web-ui.git`), but as
of DEC-052 its _checkout location_ is `<compose repo>/repos/web-next/` -- fetched by the compose
repo's own `pull-repos.sh`, the same way it fetches the upstream ReCodEx repos, not a sibling
directory anymore. When any instruction here or in `docs/` says "the compose repo" or "check the
compose repo's `services/api/` config" etc., that now means **two directories up (`../../`) from
here**, not `../ReCOdex`. Docs written before DEC-052 that still say `../ReCOdex/...` are historical
log entries (`docs/PROGRESS.md`, `docs/BACKLOG.md`) describing what was true when written -- don't
"fix" those, and don't be confused by them; this note is the current, load-bearing fact.

---

## 3. Hard constraints (never violate)

1. **Do not modify the API, the legacy frontend, or any other ReCodEx repo.** All your writes go
   into the new repo, plus one compose entry. (The running instance's _data_ is fair game — brief
   §1.)

   **The compose file is a narrow, reviewed exception to "never block".** It is the one shared file
   you touch outside your own repo, and it already carries real, hard-won fixes (sandbox
   configuration, cgroup handling, a database version pin, several upstream source patches) that are
   easy to break by accident and hard to notice you've broken. So: add your service as one new,
   self-contained entry; never edit an existing service definition. Before the first commit that
   touches this file, and again any time you change it afterwards, show the operator the diff and
   wait for an explicit go-ahead **on that file specifically**. This is the one deliberate exception
   to "never block" in this brief, and it is scoped to this file alone — everything else proceeds
   without waiting, per the "Never block" section below.

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
5. **The access token never reaches client-side JavaScript.** See brief §5.
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
parts of the brief, or you are about to touch the shared compose file (constraint 1).

---

## 6. Next.js-specific rules (footgun list)

These exist because they are where auth-gated App Router apps actually break.

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
   This is how "every error state has a retry" (brief §9) gets implemented — not with a bespoke
   client-side retry.
9. **Every route segment gets `loading.tsx` and an error boundary**, plus designed not-found and
   forbidden states. This is how "consistent states" (brief §9) gets satisfied structurally rather
   than page by page.
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
`DECISIONS.md` covering how the connection is authorised and which URL the browser gets (brief §4's
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
token — which directly conflicts with "the token never reaches client JS" (brief §5). Do not
silently drop this and do not silently hand out a token. Investigate, write up the options in
`QUESTIONS.md`, and implement the most conservative thing that preserves the capability.

**Also present, easy to miss:** the QR-code-of-current-page in the header dropdown; archived and
organisational groups; group invitations; nested subgroups; points exports; attempt limits;
per-environment assignment settings; success-exit-code configuration; judge log display; the
deprecated SIS integration page.

**License.** Legacy is MIT. Ship a matching `LICENSE` and attribute the original project.

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

## Toolchain deviations from the brief (verified, not assumed)

The brief specifies TypeScript 7.x for `next build`'s native checker. As of this session,
`typescript-eslint@8.67.0` (latest) declares `typescript: '>=4.8.4 <6.1.0'` as its peer range and
hard-crashes on load against TS 7 — confirmed by running `pnpm lint`, not by reading changelogs.
`eslint-plugin-react@7.37.5` (latest) similarly only supports `eslint@^9.7`, not the `10.x` that
`eslint-config-next@16.3.1`'s open-ended `>=9.0.0` peer range allows to install.

Pinned for now: `typescript@6.0.3`, `eslint@9.39.5`. `next build`/`tsc --noEmit` both still get a
real, working type checker either way — TS 7 was chosen for its speed, not a capability TS 6 lacks.
Re-check `typescript-eslint`'s TS 7 support (tracked at
github.com/typescript-eslint/typescript-eslint/issues/10940) and `eslint-plugin-react`'s ESLint 10
support periodically; upgrade both together when they land, don't upgrade one without the other.

**Re-checked 2026-09-02 (F-028), both pins stay.** `typescript@7.0.2` and `eslint@10.9.1` are
released, but `typescript-eslint@8.69.0` — latest, and its canary — still declares
`typescript: >=4.8.4 <6.1.0`, so TS 7 is excluded outright and that half is unchanged. The ESLint
side has moved, though: `typescript-eslint` now peers at `^8.57.0 || ^9.0.0 || ^10.0.0`, so the
only thing still capping ESLint at 9 is **`eslint-plugin-react@7.37.5`**, pulled in transitively by
`eslint-config-next` and peering at `^9.7`. Its `next` dist-tag is `7.8.0-rc.0`, an _older_ release
than latest, so there is nothing to move to. When re-checking, look at that plugin first — it is
now the whole of the ESLint blocker.

---

<!-- Next.js writes a version-matched documentation block below this line when `next dev` runs
     for the first time (brief §4). Do not delete or reformat it; add new content above it. -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
