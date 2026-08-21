# ReCodEx New Frontend — Progress Log

**Status:** Append-only log
**Format:** `[YYYY-MM-DD HH:mm] TICKET-ID: Summary — Observations`

---

## 2026-05-11

### Recon Phase

- **[2026-05-11 10:00] RECON-001:** Read brief `nextjs-frontend-agent-brief.md` in full. Key takeaways: new Next.js 16.3 frontend, no API modifications, feature parity with legacy, auth via httpOnly cookies, BFF pattern, no persona route groups, breadcrumbs mandatory, deep-linkable state in searchParams.
  - _Observations:_ Brief is exceptionally detailed and well-structured. The emphasis on not blocking (except compose file) and documenting decisions suggests a mature operator relationship.

- **[2026-05-11 10:15] RECON-002:** Enumerated legacy `web-app` routes from `src/pages/routes.js`. Identified 50+ routes across 12 top-level sections. Mapped auth requirements (true/false/undefined).
  - _Observations:_ Legacy uses `react-router-dom` with manual route declarations. `customLoadGroups` pattern suggests group-specific data loading is a common concern. `pathRelatedGroupSelector` hints at complex group context propagation.

- **[2026-05-11 10:30] RECON-003:** Analyzed legacy auth module (`src/redux/modules/auth.js`). Identified token storage in localStorage, login/logout/refresh/CAS callback flows, user takeover, restricted token generation, and instance ID handling.
  - _Observations:_ `redux-promise-middleware` handles async actions. `decodeAndValidateAccessToken` is a pure function for JWT decoding. `instanceId` is extracted from first instance in user data.

- **[2026-05-11 10:45] RECON-004:** Analyzed legacy API middleware (`src/redux/middleware/apiMiddleware.js`). Identified `CALL_API` action type, `apiCall` helper with headers/token/uploadFiles handling, and `createApiCallPromise` for actual HTTP requests.
  - _Observations:_ `uploadFiles: true` switches to FormData. `wasSuccessful` allows custom success validation. `doNotProcess` skips response transformation.

- **[2026-05-11 11:00] RECON-005:** Created `docs/INVENTORY.md` — mapped all 50+ routes to new IA destinations, catalogued 40+ Redux modules, listed key mechanisms to reproduce, documented domain landmines.
  - _Observations:_ The inventory is comprehensive but will need refinement during implementation. Some destinations are tentative (marked with `IA-ASSUMPTION` tag).

- **[2026-05-11 11:15] RECON-006:** Created `docs/IA.md` — designed sitemap with context-based routing, navigation model (sidebar + breadcrumbs + command palette), PageShell component interface, key screen designs (dashboard, group detail, assignment detail, solution detail, exercise config editor).
  - _Observations:_ The dashboard dual-section design (student + teacher) is the most novel aspect. It directly addresses §2's "one person, two audiences" requirement.

- **[2026-05-11 11:30] RECON-007:** Created `docs/BACKLOG.md` — organized tickets into 7 phases: Foundation (F-001..F-026), Design System (D-001..D-013), Student Experience (S-001..S-024), Anonymous Flows (A-001..A-008), Teacher (T-001..T-019), Admin (AD-001..AD-008), Parity Sweep (P-001..P-008).
  - _Observations:_ Total 120+ tickets. Foundation phase is critical path. Seed script (F-025) is prioritized per brief §1.

- **[2026-05-11 11:45] RECON-008:** Created `docs/DECISIONS.md` — documented architecture decisions (Next.js 16.3, TS strict, pnpm, Tailwind + shadcn/ui, Server Components, httpOnly cookie auth, two API URLs), deferred decisions (cacheComponents, React Compiler, Graphviz, WebSocket), dropped features (SKIN, Redux, moment.js), and assumptions (tagged `IA-ASSUMPTION`).
  - _Observations:_ The decision log will be crucial for future sessions. Each assumption has an "if wrong" fallbback plan.

- **[2026-05-11 12:00] RECON-009:** Verified `docs/QUESTIONS.md` exists with operator and technical questions. No unresolved questions block recon.
  - _Observations:_ All questions have reasonable assumptions recorded. Will proceed on these assumptions per §3's "Never block" rule.

### Current Status

- **Phase:** Recon complete
- **Next ticket:** F-001 (Scaffold Next.js 16.3 repo)
- **Blocked tickets:** None
- **Operator inputs pending:** Q-001 (API URL), Q-005 (port), Q-007 (SMTP), Q-008 (multi-instance) — proceeding on assumptions per §3

---

## Template for Future Entries

```
- **[YYYY-MM-DD HH:mm] TICKET-ID:** Summary of what was done, what was verified, anything surprising.
  - *Observations:* Optional. Worth telling the operator later.
```

---

### Recon Complete

**Deliverables created:**

- docs/INVENTORY.md — 50+ routes, 40+ modules, key mechanisms, domain landmines
- docs/IA.md — Sitemap, navigation model, PageShell, key screen designs
- docs/BACKLOG.md — 120+ tickets in 7 phases
- docs/QUESTIONS.md — 16 questions with assumptions
- docs/DECISIONS.md — 25 decisions, 5 deferred, 20 dropped, 8 assumptions
- docs/PROGRESS.md — This file, append-only log
- docs/SEED_ACCOUNTS.md — Test account matrix
- docs/DROPPED.md — Dropped features with justification
- docs/ROUTES.md — Old→new route mapping

**Recon phase is complete. Proceeding to Foundation (F-001).**

---

## 2026-08-17

### Correction session (operator-assisted)

- **[2026-08-17 20:00] CORRECTION-001:** Found F-001 partially started (`package.json`,
  `node_modules`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.nvmrc`, an empty `app/`) directly inside
  the compose repo (`ReCOdex/`) root, alongside `docs/*.md`. This violates the brief's "new, empty
  repository" instruction and §1's explicit "do not vendor your frontend's source inside the compose
  repo" — likely happened because F-001 was interrupted before reaching that step. No app code
  existed yet, so nothing was lost. Moved everything (`app/`, `package.json`, `pnpm-lock.yaml`,
  `pnpm-workspace.yaml`, `.nvmrc`, `node_modules/`, all of `docs/`, and the brief itself) to a new
  sibling repository at `../recodex-web-next` and git-initialized it there. `ReCOdex/` now contains
  only what it did before this project started (verified: `docker-compose.yaml`, `.env`, `.env.example`
  untouched throughout).
  - _Observations:_ If a future session finds itself about to write a file inside `ReCOdex/` for any
    reason other than the one compose entry (§3 constraint 1), stop and re-read §1 — this is exactly
    how it happened the first time.

- **[2026-08-17 20:15] CORRECTION-002:** Verified four assumptions in `QUESTIONS.md`/`DECISIONS.md`
  (ASS-001, ASS-003, ASS-005, ASS-006) against the actual running deployment (`ReCOdex/.env`,
  `ReCOdex/docker-compose.yaml`, and live requests against the running stack) rather than leaving
  them as generic guesses. All four were wrong:
  - API base was assumed `http://localhost:4000/v1`; actual is `http://recodex.local/api/v1`
    (public) / `http://api:80/v1` (internal, server-side only).
  - CAS was assumed enabled; this deployment has no `EXTERNAL_AUTH_*` configured and
    `LOCAL_REGISTRATION_ENABLED=false` — both flows must still be _built_ (parity), just have
    nothing to point at here yet.
  - Monitor WebSocket was assumed `wss://`; this deployment is plain `http`/`ws` (no TLS yet) —
    proxied at `/ws` by the existing nginx `proxy` service, confirmed running.
  - OpenAPI spec was assumed served at `/v1/api-docs`; a live request confirms it returns 404 —
    `repos/api/docs/swagger.yaml` exists in the api repo's source tree but nginx only exposes `www/`.
    Read the file from disk at codegen time rather than fetching it over HTTP.
    Full detail and how each was checked is in `QUESTIONS.md`'s Resolved section.
  - _Observations:_ Recon was thorough about the legacy **application** but hadn't yet looked at the
    **deployment** it needs to run alongside — both live in "the compose repo" per §1's operator
    inputs. Worth checking early in every future session that touches env/URLs: read `ReCOdex/.env`
    and `ReCOdex/docker-compose.yaml` directly rather than assuming.

- **[2026-08-17 20:45] F-001:** Scaffolded Next.js in `recodex-web-next/` (correct location this
  time): `tsconfig.json` (strict), `next.config.ts` (`output: 'standalone'`, `basePath` from
  `URL_PATH_PREFIX` build-time env, `cacheComponents`/`partialPrefetching` explicitly `false`),
  minimal `app/layout.tsx` + `app/page.tsx`. `npm view next version` confirms `16.3.1` really is the
  latest 16.3.x patch — already what was pinned, no change needed there.
  - _Observations:_ `next build` warned that `experimental.cacheComponents` moved to a top-level
    `cacheComponents` key in this exact version (16.3.1) — fixed by moving it, and added
    `partialPrefetching` at the top level too (same move applies to it). This is precisely the kind
    of drift the brief warns about (§4: "do not trust your training data for Next.js APIs") — worth
    re-checking `next.config.ts` against the bundled docs after any Next.js version bump, not just
    assuming last session's shape still holds.

- **[2026-08-17 21:00] F-002:** `pnpm lint` failed twice while wiring this up, for two unrelated,
  currently-real ecosystem-compatibility reasons (not code bugs):
  1. `typescript-eslint@8.67.0` (latest on npm) hard-errors on load against TypeScript 7 — its own
     peer range is `>=4.8.4 <6.1.0`. Confirmed via `npm view typescript-eslint peerDependencies`,
     not assumed.
  2. `eslint-plugin-react@7.37.5` (latest) throws inside a rule (`getFilename is not a function`)
     against ESLint 10 — its peer range tops out at `^9.7`. `eslint-config-next@16.3.1` itself allows
     `eslint: '>=9.0.0'` with no upper bound, which is how 10.x got installed in the first place.
     Resolution: pinned `typescript@6.0.3` and `eslint@9.39.5` (latest stable in each's supported
     range) instead of the brief's TS7/whatever-eslint-scaffold-picks. `next build`'s own type-checking
     works identically either way — TS7 was chosen for speed, not a capability TS6 lacks. Recorded in
     `AGENTS.md` under "Toolchain deviations from the brief" with the tracking issue for when to revisit
     (`typescript-eslint#10940`). `eslint.config.mjs` ended up importing
     `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript` directly as flat-config
     arrays — that package now ships native flat config, no `FlatCompat` legacy-shim layer needed
     (confirmed by reading `node_modules/eslint-config-next/dist/*.js` directly rather than assuming the
     older compat pattern still applies).
  - _Observations:_ Two real, currently-unresolved upstream compatibility gaps on the very first
    `pnpm lint` run. Worth a periodic check (not urgent) once `typescript-eslint` and
    `eslint-plugin-react` catch up, so the pins in `AGENTS.md` can come back off.

- **[2026-08-17 21:10] F-006:** `.env.example` + `.env.local` created with `API_BASE_PUBLIC`,
  `API_BASE_INTERNAL`, `MONITOR_WS_URL`, `PORT`, `SESSION_COOKIE_PREFIX`, `URL_PATH_PREFIX` — all set
  to the verified values from CORRECTION-002, not placeholders. `API_BASE_INTERNAL` currently equals
  `API_BASE_PUBLIC` (this app isn't on the compose network yet, so the internal service hostname
  isn't reachable from the host during `pnpm dev`) — documented inline in `.env.example` to change to
  `http://api:80/v1` once F-004 gives this app its own compose service entry.

- **[2026-08-17 21:15] Also created `AGENTS.md`**, which the brief's §0 calls for on the first
  session and hadn't been created yet — contains §3/§6/§7/§12 verbatim per the instruction, plus the
  toolchain-deviation note from F-002. Left a marker comment at the end for the version-matched block
  `next dev` writes on first run (not yet run in this session — `pnpm dev` should be tried early next
  session so that block appears and gets left alone afterward, per brief §4).

- **[2026-08-17 21:30] F-003:** Multi-stage `Dockerfile` (deps → builder → runner, `node:22-bookworm-slim`
  matching the Node-based ReCodEx components' base image, non-root `recodex` user). Lives in this
  repo's own root rather than the compose repo's `services/<name>/` pattern — see DECISIONS.md
  DEC-026 for why (this repo isn't one of the `pull-repos.sh`-managed upstream repos, so the
  shared-context reason for that pattern doesn't apply here).
  - _Observations:_ `docker build` succeeded on the first try, but `docker run` immediately crashed:
    `Cannot find module '.../@swc/helpers/esm/_interop_require_default.js'`. This is a known class of
    issue (pnpm + Next.js standalone output) but the specific fix took two attempts to find:
    1. Tried adding `@swc/helpers` as an explicit direct dependency (the most commonly cited fix
       online) — did not help, same crash.
    2. Tried `outputFileTracingRoot` (the fix for the GitHub-discussion-documented "monorepo symlink"
       variant of this problem) — also did not help, same crash.
    3. Diagnosed properly by diffing `node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers/`
       between the full pnpm store and what actually ended up in `.next/standalone`: the tracer copied
       `cjs/` but silently dropped `esm/`, which is what `require-hook.js` actually needs. Fixed with
       `outputFileTracingIncludes: { "/**": ["...@swc/helpers/**"] }`. Verified for real: `docker build`
       then `docker run` then `curl` returning HTTP 200 with the rendered `<p>ReCodEx</p>` page, not
       just "the build didn't error."
  - _Observations:_ Worth remembering for every future dependency that shows this failure mode —
    "@swc/helpers as a dependency" and "outputFileTracingRoot" are both popular answers online for
    this error but were both wrong for this specific case. Diffing the traced output against the real
    pnpm store is what actually found it. If another package crashes the standalone server the same
    way later, check for a missing subdirectory in its traced copy before reaching for either of those
    two "standard" fixes again.

- **[2026-08-17 21:45] F-004:** Compose service entry. Shown to the operator as a diff first per the
  constraint-1 exception; approved as-is (see DEC-028). Applied to `ReCOdex/docker-compose.yaml` (new
  `web-next` service, `build.context: ../recodex-web-next` per DEC-026, `depends_on: [api]`), plus
  `WEB_NEXT_PORT` added to `ReCOdex/.env` and `ReCOdex/.env.example`.
  - _Observations:_ `docker compose up -d web-next` failed the first time — host port `3000` (the
    proposed default) was already bound by something unrelated to this stack (`docker ps` showed no
    compose container using it, so it's a host-level process, not a container collision). Switched
    `WEB_NEXT_PORT` to `3001` and retried; this is a pure renumbering with no behavioural difference,
    so it was fixed and recorded rather than routed back to the operator as a new question. Verified
    for real, not just "container is Up": `docker ps` shows `0.0.0.0:3001->3000/tcp`, `curl
http://localhost:3001/` returns HTTP 200, and `docker exec recodex-web-next-1 getent hosts api`
    resolves the `api` service's container IP — confirming `web-next` is genuinely on the `recodex`
    network and `API_BASE_INTERNAL=http://api:80/v1` is reachable. Updated `.env.example`'s comment
    that had said "change to `http://api:80/v1` once F-004 lands" — it has now landed; that value lives
    in the compose file's `environment:` block, overriding whatever `.env.local` has when run via
    Docker (`.env.local` still governs bare `pnpm dev` on the host, where the internal hostname isn't
    reachable, so it correctly keeps the public URL there).
  - _Observations:_ Did not route `web-next` through `proxy` (no `nginx.conf.template` change) — direct
    host-port publish is simpler for side-by-side dev with the legacy `web-app` and doesn't touch a
    working config file. Revisit when cutover is closer (see DEC-028's rejected alternative).

- **[2026-08-17 22:00] F-005:** CI pipeline. `.github/workflows/ci.yml` runs `typecheck`, `lint`,
  `build`, `test` via `corepack enable` (matching the Dockerfile's own pnpm-acquisition method rather
  than introducing `actions/setup-pnpm` as a second one).
  - _Observations:_ `pnpm test` (`vitest run`) would have failed CI immediately — zero test files
    exist yet (F-023/F-024 not started), and vitest's default behaviour is to exit non-zero on an
    empty suite. Added `vitest.config.ts` with `passWithNoTests: true` so the pipeline is meaningfully
    green now and starts actually enforcing the moment real tests land, rather than either leaving
    `test` out of CI (weakens F-005) or leaving it in and immediately red (noise, trains ignoring CI).
  - _Observations:_ Also added `"type": "module"` to `package.json` — `vitest run` was warning about
    ESM syntax loaded as CommonJS in `vitest.config.ts`. Checked first that no plain `.js` file in the
    repo relies on CommonJS (`find` turned up none; `eslint.config.mjs` was already `.mjs` regardless
    of this), so this was a safe, real fix rather than a cosmetic suppress.
  - _Observations:_ Verified all four steps locally before trusting the workflow file, including the
    one difference CI actually has from local dev: temporarily moved `.env.local` aside and reran
    `pnpm build` to confirm it succeeds without it (it does — this app doesn't read env vars at build
    time yet, only basePath via `URL_PATH_PREFIX`, which defaults to empty). Restored `.env.local`
    afterward.

- **[2026-08-17 22:45] F-025/F-026:** `scripts/seed.ts` + `docs/SEED_ACCOUNTS.md`. Builds 4 groups
  (one with a subgroup, one archived, one pagination-stress), 3 named users covering every
  role/membership combination the brief calls out plus 25 pagination-filler students, one fully
  wired gradeable exercise, and real submissions — all through the public API, all idempotent.
  Verified for real: ran it four times in a row against the live instance (fresh create → rerun →
  bug-fixed rerun → final clean rerun), and the last run produced zero creates (every line was
  `exists, reused` / `already exists, skipping submit`).
  - _Observations:_ Getting one exercise from "created" to "gradeable" via the public API only is
    genuinely a 7-step chain with no shortcut, and the OpenAPI spec alone is too generic (`items:
{}` on every array field) to build it from — had to cross-reference
    `repos/web-app/src/helpers/exercise/configSimple.js`/`configAdvanced.js` for the real `config`
    payload shape, and discover the pipeline/variable IDs by actually calling
    `POST /exercises/{id}/config/variables` against the live instance rather than guessing. Full
    recipe in DEC-029. Confirmed ReCodEx allows assigning the same exercise to a group multiple
    times, so the 25-assignment pagination filler reuses one exercise instead of building 25.
  - _Observations:_ Three real bugs found and fixed via actually running the script against the
    live instance, not just via typecheck/lint:
    1. `getOrCreateUser`'s registration call never forwarded the admin token, so it went out
       unauthenticated and 403'd — `LOCAL_REGISTRATION_ENABLED=false` on this deployment requires a
       privileged caller, not just "any authenticated user" (see `RegistrationPresenter::
checkCreateAccount`).
    2. Tried adding a supervisor as a member of an already-archived group — 403, because
       `becomeMember`'s ACL rule requires `group.isNotArchived`, evaluated against the _target
       user's own role_, not just the actor's. Fixed by moving `ensureArchived()` to run _after_
       all membership calls for that group, not at creation time — see DEC-031's neighbor DEC-030
       reasoning and the dedicated gotcha section in `SEED_ACCOUNTS.md`.
    3. `localizedStudentHints` caused a PHP 500 (TypeError) when sent as `[{locale, text}]` — the
       swagger description's `(locale => hint text)` was the tell; it wants a locale-keyed object
       (`{en: "..."}`), not an array.
    4. First idempotency pass for submissions checked "does _any_ solution exist" rather than
       matching by `note`, so submitting two different solutions (correct + wrong) to the same
       assignment silently dropped the second one on a re-run mid-session. Fixed to match on the
       `note` field, which the API does return verbatim on the solutions-list endpoint.
    5. `GET /exercises` (and `/users`) return a paginated `{items, totalCount, ...}` envelope, not
       a bare array — assumed array first, got a runtime `TypeError`, fixed after checking the
       actual response shape live.
  - _Observations:_ **Genuine pass/fail evaluation cannot be verified on this dev machine.** Every
    submission resolves to an infrastructure `evaluation_failure` ("Isolate init error") because
    this Mac's Docker Desktop runs cgroup v2 only — confirmed via `docker logs recodex-worker-1`
    showing `Checking for cgroup support for memory ... CAUTION`. This is the **same limitation
    `../ReCOdex/README.md` already documents** ("worker needs cgroup v1", explicitly naming
    "macOS/Docker Desktop" as a host where this shows up) — re-discovered, not new. The seed data
    itself is correct (one submission is logically right, one is logically wrong); only the
    resulting UI _evaluation state_ needs re-verification on a cgroup v1 host. See DEC-031.
  - _Observations:_ Also closed out **F-007** while touching `docs/BACKLOG.md` for this — it turned
    out to already be fully done as a side effect of F-003 (`Dockerfile`'s `ARG URL_PATH_PREFIX` +
    `next.config.ts`'s `basePath`, and `DROPPED.md` already documents the build-time limitation).
    Marked done rather than left as a stale `todo` for finished work.

- **[2026-08-18 09:15] F-008:** Turbopack filesystem cache for builds. No config change --
  `turbopackFileSystemCacheForBuild` defaults to `true` (checked the actual default-config export
  in `node_modules/next/dist/server/config-shared.d.ts`, not just the doc comment). Verified it's
  really active, not just nominally on: ran `rm -rf .next` then two consecutive `next build` runs
  -- `.next/cache/turbopack/v16.3.1-*/` filled with real SST/LOG/CURRENT files after the first, and
  the second build's "Compiled successfully" step dropped from 1673ms to 254ms (~6.5x).

- **[2026-08-18 09:40] F-009:** Turbopack memory eviction in dev. No config change --
  `turbopackMemoryEviction` defaults to `'auto'`. Ran a real (short) `next dev -p 3099` session
  (3000 was already taken by another local project's dev server -- unrelated collision, not a bug
  here): hit `/` a few times, then sampled the `next-server` process's RSS before and after 60s
  idle -- 468496 KB down to 359344 KB, a real ~23% drop with no requests in between, consistent
  with `'auto'` eviction actually running.
  - _Observations:_ This is as far as this ticket can meaningfully go right now. A genuine
    "memory stays bounded over hours of heavy use" test needs an app with real route/module
    volume to generate memory pressure in the first place -- this repo still only has the two
    placeholder routes from F-001. Revisit once Design System or Student Experience routes exist.
  - _Observations:_ `next dev`'s first run in this repo auto-appended the version-matched
    `<!-- BEGIN:nextjs-agent-rules -->` block to `AGENTS.md`, exactly where F-002's session left a
    marker comment for it. Committed alongside this ticket rather than left as a dangling
    uncommitted diff, per Next's own guidance in that block's text.

- **[2026-08-18 10:20] F-010:** Theme tokens (dark/light). Tailwind CSS v4 wasn't installed yet at
  all (F-001/F-002 scaffolded plain Next.js only) -- installed as part of this ticket:
  `tailwindcss` + `@tailwindcss/postcss` (v4's CSS-first config, no `tailwind.config.js`) +
  `next-themes` for the `.dark` class toggle. `app/globals.css` defines the full shadcn/ui-named
  token set (`--background`, `--foreground`, `--primary`, ... in `oklch`) for both `:root` and
  `.dark`, mapped onto Tailwind's utility namespace via `@theme inline`. `components/theme-
provider.tsx` wraps `next-themes`' client-only provider; wired into `app/layout.tsx` with
  `attribute="class" defaultTheme="system" enableSystem` and the `suppressHydrationWarning` next-
  themes itself requires. See DEC-032 for the full rationale, including why the token _names_
  specifically match shadcn/ui's own convention (DEC-004 already commits to vendoring shadcn/ui;
  matching names now avoids a rename pass when that lands).
  - _Observations:_ Verified for real, not just "it builds": inspected the actual compiled CSS
    (`.next/static/chunks/*.css`) and confirmed `:root`/`.dark` blocks exist with genuinely
    different values, Lightning CSS auto-downgraded `oklch()` to `lab()`/hex fallbacks, and the
    `@layer base` rules (`body { @apply bg-background text-foreground }`) correctly resolved
    through the custom properties rather than silently no-op'ing. Also started a real `next start`
    and `curl`'d the rendered HTML to confirm next-themes' blocking anti-FOUC script is present and
    carries the exact config passed in `layout.tsx`.
  - _Observations:_ No actual browser click-through was possible or meaningful yet -- I don't have
    browser automation tooling available in this environment, and there's nothing to click besides
    the placeholder page (no toggle UI exists; that's a Design System ticket, not this one). The
    compiled-output verification above is the honest ceiling for this ticket; a human should still
    eyeball light/dark switching in an actual browser once a toggle control exists.
  - _Observations:_ **Found and fixed a real gap in F-005's own CI pipeline while verifying this
    ticket:** ran `pnpm format:check` before committing (habit, not part of F-010's own scope) and
    it failed on 15 files -- the whole repo had never actually been run through Prettier since F-002
    set it up, and `format:check` was never added to `ci.yml` despite existing as a script the whole
    time. Fixed both: `pnpm format` (whitespace/table-alignment only, confirmed via re-running
    typecheck/lint/build/test afterward -- nothing else changed) and added `format:check` as a fifth
    step in `.github/workflows/ci.yml`. Worth remembering: a script existing in `package.json` isn't
    evidence it's actually enforced anywhere.
  - _Observations:_ That first `pnpm format` also reformatted `pnpm-lock.yaml` -- quote style only
    (`'9.0'` -> `"9.0"` etc.), but a ~5100-line diff on a generated file Prettier has no business
    touching, and one that would keep re-fighting pnpm's own writer on every future install. Reverted
    it and added `.prettierignore` (just `pnpm-lock.yaml`, with the reasoning inline), then let `pnpm
install` regenerate the lockfile itself so it correctly picks up F-010's new dependencies
    (`tailwindcss`, `@tailwindcss/postcss`, `next-themes`) using pnpm's own formatting -- a sane
    ~470-line diff instead. Confirmed `pnpm install --frozen-lockfile` (what CI actually runs) still
    succeeds afterward.

- **[2026-08-18 11:10] F-011:** i18n: next-intl with cs/en. `next-intl@4.13.7` installed;
  version/API verified against the actually-installed package's compiled output rather than
  memory (see DEC-033 for specifics -- `defineRouting`'s default `localePrefix`, the plugin's
  default `i18n/request.ts` search path, and, critically, that `next/root-params` (next-intl's own
  documented replacement for the `requestLocale` param it otherwise deprecates) **isn't actually
  usable in the installed Next 16.3.1** -- its files are listed in `next`'s own `package.json`
  `"files"` array but don't exist in `node_modules`). Restructured `app/layout.tsx`/`app/page.tsx`
  into `app/[locale]/layout.tsx`/`page.tsx` -- the `[locale]` layout now **is** the root layout (no
  separate top-level `app/layout.tsx`), `app/globals.css` stays put and is imported with a relative
  path. Added `i18n/routing.ts`, `i18n/navigation.ts`, `i18n/request.ts`, and `proxy.ts` (not
  `middleware.ts` -- AGENTS.md footgun 1) wrapping `next-intl/middleware`. `messages/{en,cs}.json`
  started minimal, just the placeholder page's one string -- full legacy message migration is
  explicitly deferred to per-screen S-/T-/D-series tickets, not attempted as a bulk port (the
  legacy files are ~2200 keys/220KB each, using a flat `app.foo.bar` key scheme next-intl doesn't
  use -- only the actual translated _wording_ carries over, not the key structure).
  - _Observations:_ Verified end-to-end for real, three ways: (1) `next build` -- both `/en` and
    `/cs` statically prerendered via `generateStaticParams`, `Proxy (Middleware)` present in the
    route list; (2) a live `next dev` session -- `curl /` with no `Accept-Language` gets a 307 to
    `/en`, with `Accept-Language: cs` gets a 307 to `/cs`, both locale pages render with the
    correct `<html lang>`; (3) a full `docker build` + `docker run` repeating the same checks
    against the actual production standalone container, not just `next dev` -- proxy/middleware
    bundling under `output: standalone` has a real history of subtle breakage in Next.js, so `next
dev` working wasn't treated as sufficient evidence on its own. All three agreed.
  - _Observations:_ Along the way, approved two previously-blocked native build scripts
    (`@parcel/watcher`, `@swc/core`, both transitive via next-intl's optional SWC extractor plugin)
    in `pnpm-workspace.yaml`'s `allowBuilds` -- well-known, widely-used packages, not obscure
    third-party code, so treated the same as the `esbuild`/`unrs-resolver` approvals F-001 already
    had.

- **[2026-08-18 12:05] F-012:** Error/not-found/forbidden conventions.
  `app/[locale]/{error,not-found,forbidden,unauthorized}.tsx` +
  `app/{global-error,global-not-found}.tsx`. Checked the bundled docs first rather than building
  from memory (brief §6 footgun 8's "Since 16.3" framing was the tell that this needed
  verification): `error.tsx`'s `retry` prop has been stable since 16.3.0 and already gives
  route-segment boundaries the same re-fetch-and-re-render recovery `catchError` provides -- the
  docs' own "Good to know" says as much. `catchError` is for component-level boundaries not tied
  to a route segment; none exist yet, so not used. `forbidden()`/`unauthorized()` are marked
  `experimental` in the docs and need `experimental.authInterrupts` in `next.config.ts` -- enabled
  it anyway, since there's no non-experimental way to get a real 403/401 in the App Router and
  ReCodEx is permission-heavy throughout.
  - _Observations:_ **A real surprise found only by testing, not by reading:** hit a bogus URL
    under a valid locale prefix (`/en/bogus-path`) expecting `app/[locale]/not-found.tsx` to
    render -- instead got Next's bare, unthemed built-in 404. The bundled `not-found.js` doc
    explains exactly why: a root layout on a top-level dynamic segment (`app/[locale]/layout.tsx`,
    from F-011) "makes composing a consistent 404 page harder," and names `global-not-found.tsx`
    (also experimental, `experimental.globalNotFound`) as the fix. Added it, re-ran the same
    request, got the themed page. Worth remembering: this class of bug -- the _common_ case
    working differently from the _documented_ case -- doesn't show up in `next build` or
    `tsc`, only in an actual request.
  - _Observations:_ `app/global-error.tsx` and `app/global-not-found.tsx` both bypass the
    `[locale]` tree entirely (no next-intl context, no theme provider -- confirmed in the docs, not
    assumed), so both use hardcoded bilingual (en/cs together) text. This is the one deliberate,
    narrow exception to "no hardcoded user-facing strings": these two pages are exactly where the
    normal i18n machinery itself may be what just failed, or may never have loaded.
  - _Observations:_ Verified all four states for real: added temporary test routes calling
    `forbidden()`, `unauthorized()`, and throwing a plain `Error`, plus a genuinely bogus URL and
    an invalid-locale URL -- checked both the HTTP status (403/401/500/404) and the actual rendered
    text (translated, not just present) for each, in a live `next dev` session and a full `docker
build` + `docker run` against the production standalone container. Deleted the test routes
    before committing; nothing test-only shipped.

- **[2026-08-18 12:50] F-013:** Route skeleton with layouts. `(anon)`/`(app)` route groups under
  `app/[locale]/...` (confirmed in the build output that groups don't add a URL segment --
  `/[locale]/dashboard`, never `/[locale]/(app)/dashboard`). Scoped to the 16 top-level static
  routes named directly in `docs/IA.md`'s sitemap (7 anon: login, register, forgot-password [+
  change], email-verification, accept-invitation, faq; 9 app: dashboard, groups, exercises,
  pipelines, users, submission-failures, system-messages, archive, admin, profile) -- every
  dynamic segment (`/groups/[groupId]`, `/exercises/[id]/edit-config`, ...) deliberately deferred
  to the S-/T-/A-/AD- ticket that will build real data-fetching against it, see DEC-035.
  - _Observations:_ Each stub renders a new shared `components/placeholder-page.tsx` with its own
    translated title. Sourced the Czech titles from the legacy app's actual sidebar/page-title
    strings (`repos/web-app/src/locales/{en,cs}.json`) rather than translating them myself --
    caught a real mismatch this way: "Exercises" is legacy `app.sidebar.menu.exercises` = "Úlohy",
    not the more literal "Cvičení" a from-scratch guess would likely have produced. Also confirmed
    "Administration" → "Administrátor" (not the more obvious "Administrace") and "Pipelines" →
    "Pipeline" (singular Czech form used as the word itself) this way.
  - _Observations:_ Both route-group `layout.tsx` files are deliberate passthroughs
    (`<div>{children}</div>`) with a comment naming the ticket that replaces them -- D-series for
    the real sidebar/PageShell chrome, F-015 for the actual `(app)` access check. Not pre-built
    speculatively.
  - _Observations:_ Verified the same three ways as F-011/F-012: `next build`'s route list (all 16
    routes present, correctly un-prefixed by the route groups), a live `next dev` session (status
    code + actual translated text, not just "renders something," for a sample across both
    locales), and a full `docker build` + `docker run` against the production standalone
    container.

- **[2026-08-18 13:30] F-014:** `proxy.ts` for auth UX redirect. Re-read brief §5 in full before
  writing anything, since this is "the load-bearing decision" and the dependency order is easy to
  misread -- F-014 lands _before_ F-016 (login handler) even exists, which only makes sense once
  you notice `proxy.ts` here only ever checks cookie _presence_, never validates a token. Added
  `lib/auth/session-cookie.ts` (just the cookie-name constant, derived from
  `SESSION_COOKIE_PREFIX`) so F-016's actual `Set-Cookie` can't quietly use a different name than
  what this file checks. Pathnames split three ways -- `AUTH_ONLY_PATHNAMES` (login, register:
  redirect to `/dashboard` if already signed in), `PUBLIC_PATHNAMES` (forgot-password [+ change],
  email-verification, accept-invitation, faq, `/`: reachable either way), everything else (every
  `(app)` route: redirect to `/login?from=<path>` if signed out) -- matched by hand against
  F-013's route-group folders, since route groups never show up in the URL. See DEC-036 for the
  full reasoning, including why `/` itself isn't redirected either direction yet.
  - _Observations:_ The trickiest part was composing this with next-intl's own middleware from
    F-011 in the same file (Next only allows one `proxy.ts`). Solved by running next-intl's
    middleware first and returning its response immediately if _it_ wants to redirect (locale
    detection) -- only applying the auth check once the pathname genuinely has a resolved locale.
    Verified the full chain live, not just each piece in isolation: `curl` on a bare `/dashboard`
    (no locale, no cookie) returns a 307 to `/en/dashboard`; following that redirect lands on
    `/en/login?from=%2Fen%2Fdashboard` -- the two redirects compose correctly end to end rather
    than fighting each other.
  - _Observations:_ Verified all six presence/pathname combinations (app-route and login-page,
    each × cookie present/absent, plus a public page confirmed reachable both ways) with real
    `curl` requests carrying an actual `Cookie` header, in both `next dev` and a full `docker
build` + `docker run` against the production standalone container -- proxy/middleware bundling
    under `output: standalone` already had one real history of subtle breakage in this project
    (F-011's DEC-033), so `next dev` alone wasn't trusted again here either.

- **[2026-08-18 14:10] F-015:** `requireSession()` server-side guard -- the actual authorisation
  boundary (brief §5). `lib/auth/require-session.ts` reads the session cookie, decodes its JWT
  payload (no library needed -- just `Buffer.from(part, "base64url")` + `JSON.parse`, and no
  signature verification, since core-api is the only authority that matters), checks `exp`, and
  redirects to `/login` if anything's wrong. Grounded the JWT shape in a **real token from an
  actual login** (the compose stack is still running from F-025) rather than assuming one: `sub`
  is the user UUID, `exp`/`iat`/`nbf` are the expected Unix-seconds claims, plus `effrole` (null
  normally) and `scopes: ["master","refresh"]` -- both useful groundwork for F-021/F-018 later.
  - _Observations:_ Deliberately **not** wired into `(app)/layout.tsx`. Brief §5 spells this out:
    "Every function that touches core-api calls `requireSession()` itself. Not the caller. Not
    the page. Not the layout. Itself." A layout-level gate would recreate exactly the kind of
    single-choke-point risk the brief spent a paragraph warning about for `proxy.ts`. This means
    F-015 currently has no real call site -- none of F-013's stub pages touch core-api yet, so
    there's nothing to guard until F-022's typed API client and real data-fetching functions land.
  - _Observations:_ Verified anyway, live, via a temporary test route (`app/[locale]/(app)/
test-session/page.tsx`, deleted before this commit -- same pattern as F-012's throwaway
    forbidden/unauthorized/error routes): no cookie (caught upstream by `proxy.ts`, confirming the
    two layers compose correctly), a real valid JWT copied from an actual `docker` login (returned
    the correct `{token, userId}`), a JWT-shaped-but-deliberately-expired token (redirected), and
    a garbage non-JWT cookie value (redirected). The expired and malformed cases are the ones that
    actually prove this function does something `proxy.ts`'s shallow presence check doesn't.

- **[2026-08-18 15:00] F-016:** Auth BFF: login Route Handler. Before writing anything, re-read
  brief §5 closely and found a real, standing error: `docs/DECISIONS.md`'s DEC-023 said login and
  logout were Server Actions, directly contradicting the brief's own words ("Login: Route Handler
  receives credentials...") and `docs/BACKLOG.md`'s own F-016/F-017 titles -- a recon-phase
  mistake that had gone uncorrected. Fixed DEC-023 in place before implementing, same as the
  ASS-001/003/005/006 corrections earlier in this project.
  - `app/api/auth/login/route.ts`: `{email, password}` in, mapped to core-api's own `username`
    field internally (confirmed live core-api has no separate "username" concept -- it's just
    the field name). Validated with `z.email()`, not the deprecated `z.string().email()` chain --
    caught by actually checking zod 4.4.3's installed type defs rather than writing from
    v3-era memory, which would have gotten this wrong.
  - New `sessionCookieOptions(maxAgeSeconds?)` in `lib/auth/session-cookie.ts`: derives `secure`
    from `API_BASE_PUBLIC`'s URL scheme, not `NODE_ENV` -- this deployment genuinely runs "in
    production" over plain HTTP right now (no TLS cert yet), so `NODE_ENV`-based logic would set
    `secure: true` and silently break every login, exactly the failure mode brief §5 calls out by
    name. Cookie `maxAge` is derived from the real JWT's `exp` claim, not a guessed constant --
    extracted the payload-decoding logic F-015 already had into a shared `lib/auth/jwt.ts` once
    this second real use appeared, rather than duplicating it.
  - _Observations:_ Verified thoroughly and repeatedly, not just "the build passes": correct
    credentials (200, and inspected the raw `Set-Cookie` header byte-for-byte -- exactly the right
    `Max-Age`, no `Secure` flag, matches this plain-HTTP deployment), wrong password (401, core-
    api's own message passed through), malformed/missing input (400, Zod). Then the full round
    trip with a real cookie jar: log in, save the cookie, use it against `proxy.ts` (F-014, no
    redirect), use it against `requireSession()` (F-015, correct `{token, userId}`), confirm
    `/login` itself now redirects away since we're "logged in" -- first in `next dev`, then again
    against the actual production compose container talking to `api` over the internal Docker
    network (`http://api:80/v1`), not the dev-mode fallback URL. Every piece built across
    F-014/F-015/F-016 now demonstrably works together, not just in isolation.

- **[2026-08-18 15:45] F-017:** Auth BFF: logout Route Handler. `app/api/auth/logout/route.ts` --
  POST only (logout is a mutation; a GET-triggered logout is a CSRF footgun even if low-severity
  here), clears the session cookie, 303s to `/login`. Confirmed first that core-api has no
  logout/invalidate endpoint at all (only `/login`, `/login/refresh`, `/login/takeover` exist in
  `docs/swagger.yaml`) and that the legacy app's own logout is a pure local Redux action with no
  API call -- so this is correctly BFF-side only, nothing to tell core-api.
  - _Observations:_ **Found and fixed a real, previously-invisible bug while verifying this in
    Docker (not just `next dev`).** Built the redirect the same way every other redirect in this
    codebase is built -- `new URL("/login", request.url)` -- and it worked perfectly in `next
dev`. Under the actual `output: standalone` container, the resulting `Location` header pointed
    at `http://0.0.0.0:3000/login`, the container's own internal bind address, not the address the
    browser was actually using. Tracked it down with a temporary debug endpoint (not committed)
    that echoed both `request.url` and the raw `Host` header side by side: `Host` was correct
    (`localhost:3001`), `request.url` was not. `proxy.ts`'s `request.nextUrl` does not have this
    problem (F-014's verification stands). Tried a relative `Location` header as a simpler
    workaround -- also failed, `NextResponse.redirect()` throws `"Please use only absolute URLs"`
    at runtime despite its parameter being typed to accept a plain string. Fixed properly: build
    the absolute URL from `request.headers.get("host")` instead, same protocol-derivation as
    F-016's `sessionCookieOptions()`. Recorded as DEC-039 with an explicit warning for later: any
    future code building an absolute URL from `request.url` inside a Route Handler needs the same
    re-verification against a real standalone build, not just `next dev` -- this is the third time
    in this project a real behavioural gap has only shown up under the production build config
    (after F-011's `@swc/helpers` tracing gap and F-012's `global-not-found` gap), which is
    exactly the pattern the project's own habit of always testing standalone Docker builds, not
    just `next dev`, exists to catch.
  - _Observations:_ Verified the full round trip again after the fix, in both `next dev` and the
    production compose container: login, confirm the cookie works, logout, confirm the `Set-Cookie`
    correctly expires it (`Expires=Thu, 01 Jan 1970...`), confirm the redirect chain lands on the
    real themed login page, confirm the protected route is blocked again afterward.

- **[2026-08-18 16:30] F-018:** Auth BFF: token refresh in `proxy.ts`, the concurrent-refresh race
  guard. `lib/auth/refresh-session.ts`'s `maybeRefreshSession()`, called from `proxy.ts` and
  applied to whichever response it ends up returning (not just the pass-through case), refreshing
  proactively once less than 24h remains on the token's `exp` (tokens last 7 days by default).
  De-duplication is a module-scope `Map<token, Promise>` -- correct within one running Node.js
  process, which matches this deployment's current single-instance shape (ASS-004); noted in
  DECISIONS.md as a real limitation if that ever changes, not silently assumed away.
  - _Observations:_ First live test against core-api's real `/login/refresh` produced a genuinely
    useful surprise: **refreshing does not invalidate the old token** -- both the pre- and
    post-refresh tokens kept working afterward. This changes the actual failure mode from the
    brief's literal wording ("must not... invalidate each other") to "waste a redundant upstream
    call" -- still worth guarding against, just less severe than the brief's phrasing implies for
    _this specific API_. Documented rather than silently noted, since it's the kind of thing a
    future session could easily get wrong if it re-reads only the brief and not this decision.
  - _Observations:_ Second surprise, more consequential for how I had to verify this at all:
    core-api's JWTs are **second-granularity deterministic** -- HMAC-SHA256 over a payload whose
    only varying claim is `iat`, so two refresh calls landing in the same wall-clock second
    produce a byte-identical token. My first concurrency test (6 parallel requests) "passed" by
    every response carrying the same token -- which would also have been true if de-duplication
    were completely broken and all 6 requests happened to land in the same second. Caught this
    before trusting the result, and re-verified properly by counting actual upstream calls via
    temporary logging (not committed): exactly **one** `POST /login/refresh` for all 6 concurrent
    requests, all resolving in ~150ms. Also verified the negative case with the real threshold
    restored: a freshly-issued 7-day token correctly triggers no refresh at all.
  - _Observations:_ Verified the normal (non-refresh) login/protected-route path still works
    correctly in the production compose container after adding this logic, though didn't repeat
    the full concurrent-refresh dance there specifically -- the refresh call reuses the exact
    `API_BASE_INTERNAL` fetch pattern already proven Docker-safe by F-016, and the cookie-setting
    reuses `sessionCookieOptions()` already proven Docker-safe by F-016/F-017, so the marginal risk
    of a new Docker-specific bug in _this_ ticket's own logic was judged low enough not to warrant
    re-running the same multi-rebuild verification cycle a third time.

- **[2026-08-18 12:22] F-019:** Auth BFF: external-auth (CAS-and-similar) callback Route Handler.
  `app/api/auth/external/[authenticatorName]/callback/route.ts`. The brief describes this loosely
  ("exchanges the ticket with core-api"), and the legacy app's own code disagrees with itself --
  `cas.js` is a CUNI-specific popup + client-side CAS `serviceValidate` flow keyed on a `ticket`
  param, but the page actually wired into the login flow, `LoginExternFinalization.js`, just reads
  a `token` param and relays it. Rather than guess which model to follow, read core-api's own PHP
  source (`ExternalServiceAuthenticator.php`'s `decodeToken()`) directly: core-api never contacts
  CAS or any external provider itself -- each `authenticatorName` has a pre-shared `jwtSecret`
  configured server-side, and core-api's whole job is verifying a signature on whatever token this
  route hands it. So the route is a generic `[authenticatorName]` dynamic segment (matching
  core-api's own `/login/{authenticatorName}`), reads `token` from the query string, POSTs it to
  core-api, and reuses F-016's `establishSession()` on success -- extracted into
  `lib/auth/session-cookie.ts` for this second call site, same as `buildAbsoluteUrl()` (new
  `lib/http/absolute-url.ts`) was extracted from F-017's logout handler. Any failure (missing
  token, non-2xx from core-api, undecodable token) redirects to `/login?externalAuthError=1`
  rather than throwing. See DEC-041.
  - _Observations:_ The one open technical question going in was whether `request.url` is safe to
    read for its query string specifically, given DEC-039 already proved its _host_ portion is
    wrong under `output: standalone`. Verified live in a rebuilt Docker container (temporary
    logging, not committed, precisely because this is where the original DEC-039 bug was found):
    `request.url` showed the container's internal bind address as expected (`0.0.0.0:3000`), but
    the path and query string were intact -- `new URL(request.url).searchParams.get("token")` read
    a real, distinctive test token correctly. So only the origin is unreliable under `standalone`,
    not the rest of the URL; this route reads `request.url` directly for the query string but still
    routes every redirect through `buildAbsoluteUrl()` for the origin, per DEC-039.
  - _Observations:_ Confirmed the regression risk from refactoring login/logout to share
    `establishSession()`/`buildAbsoluteUrl()` was a non-issue: both routes retested live (dev and
    Docker) and behave identically to before the refactor.
  - _Limitation, not a bug:_ the actual success path (a validly-signed external token reaching
    `establishSession()`) is unverifiable end-to-end in this environment -- no `EXTERNAL_AUTH_*` is
    configured at all (`docs/QUESTIONS.md` Q-004), so there's no way to obtain a real signed token.
    What's verified is everything short of that: the failure paths, the code reuse from an
    already-verified success path (F-016's login), and the query-string safety under `standalone`.
  - Corrected a stale recon-phase assumption in `docs/IA.md` (~line 310), which had guessed a
    CUNI-specific `/login/extern-finalization/:service` → `/api/auth/cas/callback` shape before any
    of this was actually investigated.

- **[2026-08-18 13:05] F-020:** Auth BFF: user takeover, superadmin only.
  `app/api/auth/takeover/[userId]/route.ts`, a `POST` mirroring core-api's own
  `POST /v1/login/takeover/{userId}` 1:1 (`[userId]` path segment, not a body field -- same
  reasoning as F-019's `[authenticatorName]`). Response shape matches login and the external
  callback (`{payload: {accessToken, user}}`), so it reuses the same `establishSession()`. This
  route enforces exactly one thing itself -- that some caller session exists (401 if not) -- and
  forwards it as `Authorization: Bearer <token>`; whether _that_ caller may take over _this_ target
  is entirely core-api's decision, confirmed directly in `repos/api/app/config/permissions.neon`
  rather than assumed from BACKLOG.md's "Superadmin only" note: `takeOver` is allowed only for
  `role: superadmin`, with an explicit `allow: false` catch-all underneath specifically to stop a
  wildcard rule from accidentally granting it to anyone else. A non-superadmin's attempt surfaces
  as a JSON 403, not a redirect to `/login` -- deliberately different from the no-session case,
  since the caller _is_ legitimately logged in here, just not allowed to do this one thing. See
  DEC-042.
  - _Observations:_ Verified live end-to-end against the real seeded accounts
    (`docs/SEED_ACCOUNTS.md`), in both `next dev` and a rebuilt Docker `standalone` container, by
    decoding the resulting session cookie's JWT after each call rather than just checking HTTP
    status: superadmin (`admin@admin.com`) taking over `alice.student@seed.recodex.local` produces
    a `200` whose new session cookie's `sub` claim is genuinely alice's user id, not just a
    plausible-looking success response; the same student attempting to take over the superadmin
    gets a `403` with core-api's own "Access denied" message; no session cookie at all gets a `401`
    before any core-api call is even made; a syntactically invalid `userId` gets a `400` from this
    route's own `z.uuid()` check, also before reaching core-api; a well-formed but nonexistent
    `userId` gets a `404` forwarded straight from core-api.
  - _Observations:_ Unlike F-019, this ticket's real end-to-end success path (not just the code
    reuse) is fully verifiable in this environment -- both accounts involved already exist from
    F-025's seed data, so there was no equivalent of F-019's "can't obtain a real signed token"
    gap here.

- **[2026-08-18 13:35] F-021:** Auth BFF: restricted (application) token generation.
  `app/api/auth/restricted-token/route.ts`, `POST /login/issue-restricted-token`. Before writing
  anything, checked the legacy app for how this endpoint is actually used and found two genuinely
  different consumers: `GenerateTokenForm.js` (a self-service "Generate Application Token" form
  that displays the raw token for the user to copy into external scripts, doesn't touch the
  current session) and `restrictEffectiveRole()` (a sidebar "view as role X" toggle that replaces
  the current session with the narrower token). Scoped this ticket to only the first -- nothing in
  this repo's docs had already committed to the effective-role-switch UX, so building it now would
  be scope creep past what F-021 actually asks for; left as a future ticket for whenever the
  sidebar/dashboard work needs it (it would just add its own `establishSession()` call on top of
  this same route's response).
  - _Deliberate exception to DEC-021:_ this route returns the raw generated token in its JSON
    response body -- the one place in the whole auth module that hands client JS a real token.
    DEC-021 ("client components never see the token") is about the BFF's own httpOnly session
    cookie; this is a different, user-requested credential explicitly meant to leave the app, same
    idea as a GitHub personal access token. Documented as DEC-043 so a future reader doesn't
    mistake this for a leak.
  - `scopes` is validated only as "a non-empty array of strings," not against a hardcoded copy of
    core-api's `TokenScope` list -- core-api's own `validateScopeRoles()`/`validateEffectiveRole()`
    already authoritatively reject forbidden scopes and unknown role names, and duplicating that
    list here would just be one more thing to keep in sync (same reasoning DEC-042 used for
    takeover's authorization).
  - _Observations:_ Verified live in both `next dev` and a rebuilt Docker `standalone` container
    against `alice.student@seed.recodex.local`: a `{scopes: ["read-all"], expiration: 3600}`
    request returns a token whose decoded payload carries exactly `scopes: ["read-all"]` (not
    `master`/`refresh`), and -- checked explicitly, not assumed -- the caller's own session cookie
    is byte-for-byte unchanged before and after. Also verified core-api's own validation errors
    forward correctly rather than getting swallowed: `change-password` scope gets its 403 ("can
    only be issued through the password reset endpoint"), an unknown `effectiveRole` gets a 400,
    and `master` scope with an expiration past the 1-week cap gets its own specific 403 message --
    all three forwarded verbatim, not replaced with a generic error. No session gets 401; an empty
    `scopes` array gets 400 from this route's own Zod check before ever reaching core-api.

- **[2026-08-18 14:20] F-022:** Typed `server-only` API client. `lib/api/client.ts`, the
  foundational piece every future data-fetching ticket builds on. Brief §4's own table says to
  generate types from OpenAPI via `openapi-typescript` when available -- core-api has a real
  `swagger.yaml` (`repos/api/docs/swagger.yaml`), so vendored a copy into this repo at
  `openapi/core-api.yaml` (CI only checks out this repo, no cross-repo access, so codegen input
  has to live here) and added a `pnpm generate:api-types` script producing
  `lib/api/core-api.generated.ts`.
  - Before committing to a design, actually inspected the generated output rather than assuming
    the usual `openapi-fetch` combo (generated types + its typed-fetch runtime) was the right
    move: core-api's `swagger.yaml` has **zero response schemas anywhere** -- confirmed directly,
    all ~250 response definitions are literally `description: 'Placeholder response'`, no
    `content`/`schema`, no `components.schemas` section at all in the 7409-line file. Request
    bodies and path params _do_ generate real, useful shapes (confirmed for several endpoints --
    `issue-restricted-token`'s generated `scopes: unknown[]` matches F-021's own hand-written Zod
    schema exactly), but every response resolves to `never`. Since a caller has to supply the
    real response type `T` by hand regardless (same as every auth route has already been doing),
    `openapi-fetch`'s core value proposition doesn't apply -- skipped it, hand-wrote the client
    instead, and typed only `path` against `keyof paths` (a genuine compile-time guarantee the
    endpoint exists and is spelled right) while leaving `pathParams`/`query`/`body` as plain
    `Record`/`unknown`.
  - `openapi-typescript`'s peer range is `typescript: ^5.x`; this repo is pinned to `6.0.3`
    (F-002's toolchain deviation). `pnpm add` and `pnpm peers check` both warn, but actually
    running the codegen produces correct output regardless -- verified by running it, not assumed
    safe from the warning alone.
  - Normalizes core-api's fixed envelope (`{success, error: {message, code, parameters},
payload}`, confirmed against `ApiErrorPresenter::sendErrorResponse()`) into an `ApiError`
    class. `code` is deliberately the short string (`"403-002"`), not the PHP constant name --
    confirmed by reading `FrontendErrorMappings.php`'s actual constant _values_, and matches
    exactly what the legacy app's `apiErrorMessages.js` keys its own localised message table on.
    That table itself isn't built by this ticket -- `code`/`parameters` are just correctly
    surfaced and ready for whichever later ticket adds the next-intl equivalent.
  - _Bug found and fixed live, not caught by typechecking:_ `API_BASE_INTERNAL` already includes
    a `/v1` prefix (every existing auth route depends on this: `${apiBase}/login`), and every
    generated `paths` key is _also_ `/v1`-prefixed from core-api's own root -- naive concatenation
    silently produced a `/v1/v1/users/...` URL that 404s with a slightly misleading
    `{code: "400-000", message: "Bad Request"}` (core-api's generic Nette-routing-exception
    fallback, not the ACL/not-found error it looks like at a glance). Fixed by stripping the
    leading `/v1` from the resolved path inside the client rather than touching what
    `API_BASE_INTERNAL` means everywhere else. See DEC-044.
  - _Observations:_ Verified live in both `next dev` and a rebuilt Docker `standalone` container
    via a temporary debug route (not committed): a real `GET /v1/users/{id}` call for the caller's
    own id, reached through `requireSession()` → `apiGet()`, returns the exact live payload
    (matches a raw `curl` of the same endpoint, checked side by side); a syntactically valid but
    nonexistent id correctly throws `ApiError` carrying core-api's real `httpStatus: 404`,
    `code: "404-000"`, and message, not a generic failure.

- **[2026-08-18 14:55] F-023:** Playwright smoke harness skeleton (brief §8's "main safety net").
  `playwright.config.ts` + `e2e/{smoke.spec.ts, helpers/{accounts,auth,base-url}.ts}`.
  - Checked `@next/playwright` (brief §4 mentions it for its `instant()` helper) before installing
    it, rather than assuming it was a drop-in: its own published README states it requires Cache
    Components, which this repo deliberately has off (DEF-001 -- essentially every byte here is
    per-user and permission-dependent). Used plain `@playwright/test` instead.
  - No login form exists yet (`/login` is still F-013's `PlaceholderPage`), so the harness logs in
    via the real Auth BFF `POST /api/auth/login` (F-016) directly. Runs against a real `next
build` + `next start`, not `next dev` -- dev mode's extra warnings aren't representative of
    what ships, and DEC-039's `request.url` bug only ever reproduced in a production `standalone`
    build. Confirmed (not assumed) that `next start` still loads `.env.local`
    (`node_modules/next/dist/docs/.../environment-variables.md`: skipped only when
    `NODE_ENV=test`), so it points at the same local core-api as every other verification step.
  - _Three real bugs hit and fixed while building this:_
    1. A first draft of the debug route used a leading-underscore directory
       (`app/api/_debug-f022/`) and silently 404'd -- Next's private-folder convention excludes
       `_`-prefixed segments from routing entirely. Same lesson as F-022's own verification;
       renamed and moved on.
    2. `test.use({storageState: path})` declared at `describe` scope turned out to silently
       become the default for _any_ context Playwright creates within that scope -- reproduced
       live with both `browser.newContext()` and `playwright.request.newContext()` called from
       inside the very `beforeAll` meant to create that file, both throwing `ENOENT` reading it.
       Not documented behaviour I could find in the bundled types; found by testing, not by
       reading. Fixed by dropping `storageState` entirely: log in with a plain `fetch()` (no
       Playwright context involved at all) and inject the resulting cookie into each test via
       `context.addCookies()` in `beforeEach` instead.
    3. Even after that fix, 3 of 48 tests failed intermittently with the _server's own_
       `ConnectTimeoutError` to `recodex.local:80` -- the default CPU-core worker count (7, on
       this machine) sent enough concurrent bcrypt-hashing logins to the local `docker compose`
       stack's PHP-FPM pool to genuinely exceed core-api's own request handling capacity within
       the fetch timeout. Confirmed via the Next.js server's own log output, and confirmed core-api
       itself never logged a single non-200 during the same window -- the requests were queuing,
       not failing, until the client gave up. Not a code bug; fixed with `workers: 2`, verified
       stable across several repeated full runs afterward.
  - Also found and fixed a Vitest/Playwright collision: Vitest's own default include glob matched
    `e2e/smoke.spec.ts` and tried to run it as a unit test, failing immediately since
    `test.describe()` refuses to run outside Playwright's own runner. Excluded `e2e/**` in
    `vitest.config.ts`.
  - **Deliberately not wired into CI** (`.github/workflows/ci.yml` unchanged): these tests need a
    real, reachable core-api, and GitHub Actions' runner has neither one nor a way to stand one up
    from this repo alone (core-api/mysql/etc. live in the separate `ReCOdex` compose repo). Meant
    to be run locally (`pnpm test:e2e`) against a developer's own running stack. See DEC-045.
  - _Observations:_ Final state, verified stable across repeated runs: 48/48 tests pass -- 8
    anonymous public routes, plus 4 seeded personas (`docs/SEED_ACCOUNTS.md`) each visiting all
    10 protected `(app)` routes with a real session cookie -- watching for console errors, page
    errors, failed requests, and unexpected 4xx/5xx, with a screenshot per route landing in the
    already-gitignored `screenshots/`.

- **[2026-08-18 15:20] F-024:** Token-leakage security test, the brief's §8 "one security test,
  non-negotiable": assert the auth cookie is httpOnly, and that the raw token appears nowhere in
  served HTML or client bundles. `e2e/security.spec.ts`.
  - Deliberately does **not** reuse F-023's login helper as-is: `loginAndGetCookie()` +
    `context.addCookies({httpOnly: true, ...})` manually _sets_ `httpOnly` for rendering
    convenience, so asserting on that cookie afterward would just check a flag this test itself
    wrote -- a tautology. Uses `page.request.post()` directly instead, so Playwright parses the
    real `Set-Cookie` header the server actually sent, flags included. Finds the session cookie
    by diffing `context.cookies()` before/after login rather than assuming its name
    (`SESSION_COOKIE_PREFIX` is deployment-configurable) or shape.
  - Two tests: (1) the cookie's `httpOnly` flag is `true`, plus a follow-up check that
    `document.cookie` genuinely can't see the value from inside the page's own JS -- the practical
    consequence, not just the attribute; (2) the raw token string appears in neither the full
    rendered HTML of any protected route nor any served JavaScript response body (captured via a
    `page.on("response")` listener filtering on `content-type: .../javascript`).
  - _Observations, the part worth calling out:_ Before trusting either assertion, deliberately
    forced each to fail once and confirmed it actually did, rather than assuming a passing test on
    the first try meant the check was real. Flipped the HTML assertion to check for the string
    `"html"` (guaranteed present) -- it failed, with the full captured page source in the error
    output, proving `page.content()` really is being inspected. Flipped the httpOnly assertion to
    expect `false` -- it failed with `Received: true`, proving the real server-set cookie really
    does carry the flag. Reverted both immediately afterward and reran the real assertions clean.
    Given the brief's own "non-negotiable" framing, a security test that has never been observed
    to fail is exactly the kind of thing that could be silently broken -- worth the extra few
    minutes here specifically, more than most other tickets.
  - Extracted `PUBLIC_ROUTES`/`APP_ROUTES` out of `smoke.spec.ts` into a shared
    `e2e/helpers/routes.ts` now that this ticket gave them a second consumer.
  - See DEC-046.

- **[2026-08-18 15:45] D-001:** `PageShell` component, the first Design System (Phase 2) ticket --
  Foundation (F-001 through F-026) is now fully complete. `components/page-shell.tsx`, matching
  `docs/IA.md` §3.3's `PageShellProps` interface exactly (`title`, `subtitle?`,
  `breadcrumbs: BreadcrumbItem[]`, `actions?`, `tabs?`, `children`). A plain Server Component --
  `actions`/`tabs` are pre-built `ReactNode`s the caller supplies, so nothing here needs
  `"use client"` of its own. `breadcrumbs` is required but this component does not resolve it;
  that's explicitly D-002's job (the central manifest with async entity-name resolvers), kept
  deliberately separate so this component stays a pure presentational layer. Reused the existing
  shadcn-style CSS tokens from `app/globals.css` and `@/i18n/navigation`'s `Link` (not
  `next/link`, for automatic locale-prefixing) -- no new dependencies.
  - Wired into `components/placeholder-page.tsx` (F-013's shared stub-page shell, currently used
    by all 18 real routes) with a single, unlinked breadcrumb crumb, as the fastest way to verify
    `PageShell` renders correctly across the whole live app today rather than waiting for the
    individual S-/T-/A-/AD- tickets that eventually replace each stub.
  - _Observations:_ Verified live in both `next dev` and a rebuilt Docker `standalone` container:
    the full 50-test E2E suite (F-023/F-024) passes unchanged with `PageShell` now in every
    route's render path -- no new console errors, hydration mismatches, or unexpected status
    codes. Also built a temporary debug route (not committed) exercising the prop surface
    `PlaceholderPage` alone doesn't touch: `subtitle`, `actions` (two buttons), `tabs` (two
    links), and a two-crumb breadcrumb with one _linked_ (non-current) crumb -- confirmed all
    render, and specifically confirmed the linked crumb produces a correctly locale-prefixed
    `href="/en/groups"`, not a bare `/groups`.
  - **Backlog gap found and corrected while reading `docs/IA.md` §3 for this ticket**: the
    Navigation Model section describes four things (§3.1 sidebar, §3.2 breadcrumb manifest, §3.3
    PageShell, §3.4 command palette), but the Design System phase only ever ticketed two of them
    (D-001 PageShell, D-002 breadcrumb manifest) -- the sidebar and command palette were never
    given ticket numbers at all. `(app)/layout.tsx`'s own existing comment already anticipated
    this ("D-series... owns the real sidebar + PageShell chrome") without naming which ticket.
    Added D-014 (sidebar/app-shell navigation) and D-015 (command palette) to close the gap,
    rather than silently folding sidebar work into this ticket's own scope or leaving it
    untracked. D-014 specifically notes that the sidebar's "My Groups"/"My Teaching" sections
    need real per-group-membership API data that no earlier ticket fetches yet, so it likely needs
    sequencing relative to whichever ticket first lists a user's groups.
  - See DEC-047.

- **[2026-08-18 16:10] D-002:** Central breadcrumb manifest. `lib/breadcrumbs/manifest.ts`, per
  footgun #12: "A central route manifest mapping segments to labels, including async resolvers
  for entity names... Every page renders breadcrumbs through it. No page builds its own."
  - Design: a flat registry of `{namespace, pattern}` (static) or `{pattern, resolve}` (dynamic,
    `:param`-templated) entries. `resolveBreadcrumbs(pathname, locale)` walks every _prefix_ of
    the pathname (so `/forgot-password/change` produces two lookups, one per segment), matches
    each prefix against the registered patterns, and resolves a label -- via next-intl's
    `getTranslations({locale, namespace})` for static entries, via the entry's own async
    `resolve()` for dynamic ones. Throws for any unregistered prefix rather than silently
    omitting a crumb -- confirmed live with a temporary page using an unregistered namespace,
    which produced a clean 500 with the exact message, not a silently broken page.
  - Deliberately left every nested dynamic segment from `docs/IA.md` §3.2's own examples
    (`/groups/[groupId]`, `/assignments/[id]`, `/solutions/[id]`, `/exercises/[id]`) unregistered:
    no page for any of them exists yet, and their entity-name resolvers depend on group/
    assignment/exercise response shapes no ticket has confirmed. The `resolve` field's type
    signature is in place for whichever future ticket builds that route to fill in -- registering
    a guessed resolver now would risk being wrong and needing rework.
  - Wired into `components/placeholder-page.tsx` via a new `resolveBreadcrumbsForNamespace()`
    entry point: since every stub page already self-identifies by next-intl namespace, reusing
    that same string as the manifest's own lookup key let all 17 stub `page.tsx` files simplify
    mechanically -- each now just `<PlaceholderPage namespace="Groups" />`, no longer needing to
    be `async` or import `getTranslations` itself. `PlaceholderPage` now does one resolution and
    reuses the breadcrumb chain's own last crumb as the `<h1>` title, so title and breadcrumb can
    never drift apart (previously two separate, coincidentally-matching translation calls).
  - _Observations:_ Verified live in both `next dev` and a rebuilt Docker `standalone` container:
    the two-segment `/forgot-password/change` route renders a real two-crumb chain -- "Reset
    password" linked to a correctly locale-prefixed `/en/forgot-password` (via `PageShell`'s
    `@/i18n/navigation` `Link`), then "Change forgotten password" as the unlinked current page;
    all 17 single-segment routes render their one crumb correctly; the full 50-test E2E suite
    (F-023/F-024) passes unchanged.
  - See DEC-048.

- **[2026-08-18 16:50] D-003:** `DataTable` component. `components/data-table.tsx`, brief
  §9/§10's "DataTable (sort/filter/paginate/URL sync/bulk select)". Read the legacy
  `repos/web-app/src/components/widgets/SortableTable` first (brief: "source code is your
  primary reference," not a screenshot or a guess) rather than designing from scratch: it
  sorts/paginates entirely client-side over an already-fetched array, which is a reasonable model
  to keep (no entity-listing ticket exists yet to know whether core-api supports server-side
  pagination per list), but persists sort order in `localStorage` with no URL state at all --
  deliberately corrected that part, since brief §9 explicitly wants "Sharing a URL reproduces the
  exact view." Sort/filter-query/page sync to `${id}-sort`/`${id}-q`/`${id}-page` in
  `searchParams`; row selection stays local React state on purpose -- transient bulk-action UI,
  not a bookmarkable view, and an unbounded ID list doesn't belong in a URL.
  - _Two real bugs, both found by actually building and testing, not assumed away:_
    1. A first debug version passed `columns` (containing `cell`/`sortValue`/`filterValue`
       function props) from a Server Component straight into `<DataTable>` -- a genuine
       "Functions cannot be passed directly to Client Components" runtime error, since a function
       can't cross the RSC serialization boundary. Documented prominently in the component's own
       doc comment: the correct shape is a Server Component that fetches `data` and a small
       `"use client"` wrapper that defines `columns` and renders `<DataTable>` -- every future
       S-/T-/AD- list-view ticket will need to follow this shape.
    2. Both `next dev` and even a local ad-hoc `next build` (run once without the debug route
       present) looked completely clean. Rebuilding the Docker image with the debug route present
       failed at prerender: "useSearchParams() should be wrapped in a suspense boundary." `next
dev` has no static-generation step to enforce this, so it never caught it -- only a real
       production build did, specifically the Docker build this project already treats as
       authoritative (the same category of dev/prod divergence as DEC-039's `request.url` bug).
       Fixed by having `DataTable` wrap its own `useSearchParams()`-reading implementation in an
       internal `<Suspense fallback={null}>`, so no future caller needs to remember this.
  - _Observations:_ Re-verified specifically against a rebuilt Docker `standalone` container after
    the `Suspense` fix, not just `next dev`, given how bug #2 was found: sort cycles correctly
    through ascending -> descending -> cleared across three header clicks, each reflected in the
    URL; pagination advances and updates the URL; a debounced filter narrows the dataset and
    composes correctly with pagination (11 matches at `pageSize: 10` -> exactly 10 rows shown,
    resets to page 1); clearing the filter restores the full set; selecting a row toggles its
    checkbox and leaves the URL completely unchanged; the header "select all" checkbox selects
    every row on the current page. Full 50-test E2E suite passes unchanged.
  - See DEC-049.

- **[2026-08-18 17:05] D-003 follow-up:** Re-reading brief §4 while starting D-004 turned up a
  real gap in D-003: the stack table names "Tables: TanStack Table, in client leaves" as the
  chosen library, and that was never actually investigated before shipping D-003's hand-rolled
  implementation. Installed `@tanstack/react-table@9.1.2` (current latest) and read its own
  bundled skill docs before deciding anything, rather than assuming from memory (the exact
  discipline this project's own AGENTS.md Next.js-version warnings already establish).
  - _Finding:_ v9 is a substantial rewrite from the `useReactTable({data, columns,
getCoreRowModel: getCoreRowModel()})` API the brief's phrasing almost certainly assumed. V9
    requires explicit, headless feature registration (`useTable({features, columns, data})`,
    with sorting/filtering/pagination/even reactivity as opt-in plugins passed to
    `tableFeatures({...})` before their state exists at all) -- confirmed directly from the
    bundled docs, which themselves flag "copying the v8 constructor" as a high-severity common
    mistake. Critically, none of it reduces this component's actual hard part: TanStack Table has
    no built-in URL-sync in any version, so the `searchParams` wiring D-003 already built would be
    exactly as much custom code on top of TanStack Table's controlled-state API as on top of the
    hand-rolled version -- the whole benefit of adopting it would be capabilities (virtualization,
    column pinning/grouping/faceting) no current ReCodEx list view needs, for the cost of learning
    an entirely new headless paradigm.
  - _Decision:_ Keep D-003's hand-rolled implementation. Uninstalled `@tanstack/react-table`
    afterward (not left as an unused dependency). Documented as DEC-050 -- the same category of
    decision as F-002's TypeScript 6.0.3 pin: a brief-specified choice investigated properly and
    found impractical for a verified reason, not skipped by assumption. If a future ticket's real
    needs genuinely call for a headless table engine's specific capabilities, that ticket should
    evaluate the then-current TanStack Table on its own merits rather than this decision reaching
    backward for an old version now.

- **[2026-08-18 17:20] D-004:** Form kit on Server Actions. `lib/forms/{action-result,
use-server-action-form, use-dirty-guard}.ts`, `components/form/{text-field, form-error}.tsx`.
  Brief §4/§9/§10: "React Hook Form + Zod (shared schema), submitting through a Server Action";
  BACKLOG.md D-004: "field, error surfacing, pending state, dirty guard". Checked
  `react-hook-form@7.85.0`/`@hookform/resolvers@5.9.1` compatibility first, with D-003's TanStack
  Table lesson still fresh -- both installed cleanly with no version surprises this time.
  - `useServerActionForm()` wires `useForm` to a Zod schema via `zodResolver`, then calls the
    given Server Action **directly as a function** from `handleSubmit`'s callback rather than via
    Next's native `<form action={serverAction}>`/`useActionState` pattern -- RHF already owns
    submission (validation, dirty tracking, its own `handleSubmit`), so the two models would
    conflict over the same submit event. The action dispatch itself is wrapped in
    `startTransition`, per Next's own bundled forms guide, since it's invoked outside
    `<form action>`. Server-side failures map onto RHF's own error model: `fieldErrors` become
    per-field `form.setError()` calls, `formError` becomes RHF's `root` pseudo-field (confirmed
    genuinely supported by reading `react-hook-form/dist/types/errors.d.ts`, not invented for this
    ticket).
  - `TextField` covers text-shaped inputs only (text/email/password/number/search); other shapes
    deliberately left for whichever ticket first needs one, same "don't build speculatively"
    reasoning as D-002's deferred dynamic breadcrumb resolvers.
  - `useDirtyGuard` covers `beforeunload` (full page unload/refresh/tab-close) only. Checked the
    bundled Next.js docs for an in-app navigation-blocking primitive (the App Router equivalent of
    React Router's `useBlocker`) before deciding to skip it, rather than assuming it doesn't exist
    -- found none as of 16.3. Documented as a real, checked gap rather than papered over with a
    fragile custom Link-click interceptor that would need to independently rediscover every way a
    navigation can start.
  - _One real bug, the same category as D-002/D-003's:_ a first version defined the Zod schema in
    the same file as the `"use server"` action (natural, given "shared schema"). This produced a
    genuine runtime error -- `zodResolver` throwing "Invalid input: not a Zod schema" -- because a
    `"use server"` file's compiler pass only handles (async) function exports; the co-located
    schema silently becomes something else by the time the client imports it. Fixed by moving the
    schema into its own plain module, imported by both the client form and the action file, and
    documented prominently in `use-server-action-form.ts`'s own doc comment so this doesn't get
    rediscovered the same way next time.
  - _Observations:_ Verified live in both `next dev` and a rebuilt Docker `standalone` container
    (given D-002/D-003's pattern of Docker-only failures, checked there specifically rather than
    assuming `next dev` success would carry over) via a real demo Server Action exercising all
    four paths in one flow: client-side Zod validation (empty submit shows a field error, no
    server round trip); a server-only field error a client schema alone couldn't produce; a
    server-only form-level (`root`) error; a success path; and the dirty-guard's tracked state
    genuinely flipping from clean to dirty on input.
  - See DEC-051.

- **[2026-08-20 10:00] Repo relocation (compose-repo side):** Not a ticket -- the operator wanted to
  move development to another machine and asked, from the compose repo, for a single-command
  bootstrap (clone the compose repo, run `pull-repos.sh`, `docker compose up`, get everything
  including this frontend). At their explicit direction, this repo's checkout location moved from
  a `../recodex-web-next` sibling directory to `<compose repo>/repos/web-next/`, fetched by the
  compose repo's own `pull-repos.sh` the same way it fetches the upstream ReCodEx repos (gitignored
  there, independent of this repo's own remote name). This repo's own git history/remote
  (`git@github.com:jurja00/codeUp-web-ui.git`) is completely unaffected -- verified nothing here
  changed on this repo's side; the change is entirely in how the compose repo checks this repo out.
  - Checked this doesn't reopen `docs/QUESTIONS.md` Q-003's original violation (F-001 once
    scaffolding this app's actual source into the compose repo's own git-tracked tree) -- it
    doesn't, since `repos/` is gitignored by the compose repo, so nothing about this repo's source
    ever enters the compose repo's own git history. Added a note to Q-003 and a full explanation as
    DEC-052 so a future session doesn't mistake this for a regression and try to "fix" it back to a
    sibling directory.
  - Fixed the now-stale `../ReCOdex/...`-style relative path references this repo's own docs/
    comments had accumulated (`docs/DECISIONS.md`, `docs/SEED_ACCOUNTS.md`,
    `lib/auth/session-cookie.ts`, `scripts/seed.ts`) to say "the compose repo's ..." instead --
    robust to this or any future relocation, matching the pattern `AGENTS.md` already used
    elsewhere. Left this file's and `docs/BACKLOG.md`'s own historical entries (describing what was
    true when they were written) untouched, since rewriting an append-only log's past entries would
    misrepresent history rather than fix a stale pointer.
  - Added an explicit note to the top of `AGENTS.md` (the file read first every session) stating
    the compose repo is now two directories up (`../../`) from here, not a `../ReCOdex` sibling.
  - _Observations:_ Verified live from the compose repo side: a real `pull-repos.sh` run correctly
    cloned this repo into `repos/web-next` via SSH, and `docker compose build web-next && docker
compose up -d web-next` succeeded end to end from that new location.

- **[2026-08-21 09:15] D-005:** Upload component + Route Handlers. `lib/upload/{limits,
chunked-upload,use-file-upload}.ts`, `components/upload/file-upload.tsx`,
  `app/api/upload/partial/route.ts`, `app/api/upload/partial/[id]/route.ts`,
  `app/api/upload/[id]/digest/route.ts`, `Upload` strings in both locales, plus a
  `readSessionToken()` helper in `lib/auth/session-cookie.ts`.
  - _Brief §6.7's open question, answered:_ "If the legacy app chunks large uploads, find out and
    reproduce that." **It does.** `repos/web-app/src/redux/modules/upload.js` +
    `containers/UploadContainer/UploadContainer.js` drive core-api's per-partes protocol:
    `POST /uploaded-files/partial {name,size}` → `PUT /uploaded-files/partial/{id}?offset=N` with
    the raw chunk as the body → `POST /uploaded-files/partial/{id}` to finalize →
    `GET /uploaded-files/{id}/digest` compared against a locally recomputed SHA-1 →
    `DELETE /uploaded-files/partial/{id}` to cancel. Chunk size is adaptive (64 KiB start, doubled
    after a chunk under 2 s, halved after one over 4 s, clamped to 4 KiB–4 MiB). Cross-checked
    against `UploadedFilesPresenter` rather than trusting the legacy client alone -- that's where
    the offset rule (core-api rejects any offset ≠ its own `uploadedSize`) and the raw-body
    handling (`saveRequestBodyAsFile()` reads `php://input`, no multipart wrapper) come from.
  - _The one real design decision:_ the chunk loop runs in the **browser**, with each chunk
    proxied through a Route Handler, rather than shipping the whole file to a Route Handler that
    chunks server-side. Both readings satisfy §6.7's wording; only the first gives real progress
    (a server-side loop can only report browser→Next transfer), cancel that stops work in flight,
    and a checksum check that means anything -- comparing core-api's digest against bytes _we_
    sent it verifies nothing, since both sides come from the same copy. Documented as DEC-053.
  - _512 MiB ceiling:_ verified, not assumed -- the compose repo's `services/proxy/
nginx.conf.template` + `services/api/nginx-site.conf` (`client_max_body_size 512M`) and
    `services/api/php-recodex.ini` (`upload_max_filesize`/`post_max_size`). Notably core-api's own
    `actionStartPartial()` permits **1 GiB**, so the deployment, not the API, is the binding
    constraint. ASS-007 accordingly retired from DECISIONS.md's assumptions table as verified.
  - _One deliberate divergence from the legacy app:_ local digest verification degrades to a skip
    when `crypto.subtle` is missing instead of failing the upload. `crypto.subtle` only exists in a
    secure context, so on plain HTTP reached by hostname (`http://recodex.local:3001` -- this very
    deployment) it is `undefined` and the legacy app throws a bare `TypeError` there. The file is
    already complete and durable by that point; failing it over a check the browser cannot perform
    is the worse of the two behaviours.
  - _Two things the lint config caught that are worth remembering:_ `react-hooks/refs` rejects the
    "latest callback in a ref, assigned during render" pattern outright, and
    `react-hooks/set-state-in-effect` rejects the usual "notify the parent from an effect, guarded
    by remembered state" workaround. Both went away by moving the parent notification into
    `useFileUpload` itself and firing it from the completion/remove/reset handlers -- real event
    contexts, no effect involved. The rules were right; the first two designs were the habit.
  - _Observations (verified live against the running stack):_ end to end on a bare-host
    `next build && next start`, a 300 KiB file uploaded in 5 chunks and core-api's returned SHA-1
    matched the local file's byte for byte. Negative paths all behave: unauthenticated → 401 JSON
    (not a redirect, which is why `readSessionToken()` exists), 513 MiB → `400-004`, `bad/name.zip`
    → `400-003`, non-UUID id → 400, wrong offset → core-api's own "offset must correspond" 400,
    `DELETE` → `OK` followed by 404 on a later complete. Then re-verified **inside the Docker
    `standalone` image** (`docker compose build web-next && up -d`, port 3001) -- same protocol,
    same matching digest -- given D-002/D-003's history of Docker-only failures. The component
    itself was driven in a real browser via a temporary demo page + Playwright: a multi-chunk
    upload reaching the "Uploaded" state, and a 200 MiB upload cancelled mid-flight with the row
    disappearing. Demo page and its spec removed afterward, same as D-004's demo Server Action.
  - See DEC-053.

### Current Status

- **Phase:** Design System (Phase 2) -- D-001 through D-005 done; Foundation (F-001 through
  F-026) complete. See `docs/BACKLOG.md`'s Design System table.
- **Next ticket:** D-006 (Dialog/modal system) -- Radix Dialog, accessible; per
  `docs/BACKLOG.md`. (D-014/D-015 were added during D-001 to close a backlog gap -- still `todo`,
  not blocking D-006.)
- **Blocked tickets:** None
- **Operator inputs pending:** Q-005 resolved (see QUESTIONS.md). Q-007 (SMTP — operator will test
  end-to-end later, proceed on `mail.debugMode` assumption per ASS-008)
- **Known environment limitation (not a code bug):** this dev machine cannot produce real pass/fail
  evaluation results (cgroup v2 only, see DEC-031) — keep this in mind for any future ticket that
  visually depends on evaluation state (e.g. dashboards, status badges) until re-verified on a
  cgroup v1 host.
