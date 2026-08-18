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

### Current Status

- **Phase:** Foundation (F-001 through F-011, F-025, F-026 done -- see `docs/BACKLOG.md` for the
  full per-ticket table)
- **Next ticket:** F-012 (Error/not-found/forbidden conventions) -- `catchError` from `next/error`,
  per `docs/BACKLOG.md`.
- **Blocked tickets:** None
- **Operator inputs pending:** Q-005 resolved (see QUESTIONS.md). Q-007 (SMTP — operator will test
  end-to-end later, proceed on `mail.debugMode` assumption per ASS-008)
- **Known environment limitation (not a code bug):** this dev machine cannot produce real pass/fail
  evaluation results (cgroup v2 only, see DEC-031) — keep this in mind for any future ticket that
  visually depends on evaluation state (e.g. dashboards, status badges) until re-verified on a
  cgroup v1 host.
