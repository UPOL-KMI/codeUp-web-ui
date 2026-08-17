# ReCodEx New Frontend — Progress Log

**Status:** Append-only log
**Format:** `[YYYY-MM-DD HH:mm] TICKET-ID: Summary — Observations`

---

## 2026-05-11

### Recon Phase

- **[2026-05-11 10:00] RECON-001:** Read brief `nextjs-frontend-agent-brief.md` in full. Key takeaways: new Next.js 16.3 frontend, no API modifications, feature parity with legacy, auth via httpOnly cookies, BFF pattern, no persona route groups, breadcrumbs mandatory, deep-linkable state in searchParams.
  - *Observations:* Brief is exceptionally detailed and well-structured. The emphasis on not blocking (except compose file) and documenting decisions suggests a mature operator relationship.

- **[2026-05-11 10:15] RECON-002:** Enumerated legacy `web-app` routes from `src/pages/routes.js`. Identified 50+ routes across 12 top-level sections. Mapped auth requirements (true/false/undefined).
  - *Observations:* Legacy uses `react-router-dom` with manual route declarations. `customLoadGroups` pattern suggests group-specific data loading is a common concern. `pathRelatedGroupSelector` hints at complex group context propagation.

- **[2026-05-11 10:30] RECON-003:** Analyzed legacy auth module (`src/redux/modules/auth.js`). Identified token storage in localStorage, login/logout/refresh/CAS callback flows, user takeover, restricted token generation, and instance ID handling.
  - *Observations:* `redux-promise-middleware` handles async actions. `decodeAndValidateAccessToken` is a pure function for JWT decoding. `instanceId` is extracted from first instance in user data.

- **[2026-05-11 10:45] RECON-004:** Analyzed legacy API middleware (`src/redux/middleware/apiMiddleware.js`). Identified `CALL_API` action type, `apiCall` helper with headers/token/uploadFiles handling, and `createApiCallPromise` for actual HTTP requests.
  - *Observations:* `uploadFiles: true` switches to FormData. `wasSuccessful` allows custom success validation. `doNotProcess` skips response transformation.

- **[2026-05-11 11:00] RECON-005:** Created `docs/INVENTORY.md` — mapped all 50+ routes to new IA destinations, catalogued 40+ Redux modules, listed key mechanisms to reproduce, documented domain landmines.
  - *Observations:* The inventory is comprehensive but will need refinement during implementation. Some destinations are tentative (marked with `IA-ASSUMPTION` tag).

- **[2026-05-11 11:15] RECON-006:** Created `docs/IA.md` — designed sitemap with context-based routing, navigation model (sidebar + breadcrumbs + command palette), PageShell component interface, key screen designs (dashboard, group detail, assignment detail, solution detail, exercise config editor).
  - *Observations:* The dashboard dual-section design (student + teacher) is the most novel aspect. It directly addresses §2's "one person, two audiences" requirement.

- **[2026-05-11 11:30] RECON-007:** Created `docs/BACKLOG.md` — organized tickets into 7 phases: Foundation (F-001..F-026), Design System (D-001..D-013), Student Experience (S-001..S-024), Anonymous Flows (A-001..A-008), Teacher (T-001..T-019), Admin (AD-001..AD-008), Parity Sweep (P-001..P-008).
  - *Observations:* Total 120+ tickets. Foundation phase is critical path. Seed script (F-025) is prioritized per brief §1.

- **[2026-05-11 11:45] RECON-008:** Created `docs/DECISIONS.md` — documented architecture decisions (Next.js 16.3, TS strict, pnpm, Tailwind + shadcn/ui, Server Components, httpOnly cookie auth, two API URLs), deferred decisions (cacheComponents, React Compiler, Graphviz, WebSocket), dropped features (SKIN, Redux, moment.js), and assumptions (tagged `IA-ASSUMPTION`).
  - *Observations:* The decision log will be crucial for future sessions. Each assumption has an "if wrong" fallbback plan.

- **[2026-05-11 12:00] RECON-009:** Verified `docs/QUESTIONS.md` exists with operator and technical questions. No unresolved questions block recon.
  - *Observations:* All questions have reasonable assumptions recorded. Will proceed on these assumptions per §3's "Never block" rule.

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
  - *Observations:* If a future session finds itself about to write a file inside `ReCOdex/` for any
    reason other than the one compose entry (§3 constraint 1), stop and re-read §1 — this is exactly
    how it happened the first time.

- **[2026-08-17 20:15] CORRECTION-002:** Verified four assumptions in `QUESTIONS.md`/`DECISIONS.md`
  (ASS-001, ASS-003, ASS-005, ASS-006) against the actual running deployment (`ReCOdex/.env`,
  `ReCOdex/docker-compose.yaml`, and live requests against the running stack) rather than leaving
  them as generic guesses. All four were wrong:
  - API base was assumed `http://localhost:4000/v1`; actual is `http://recodex.local/api/v1`
    (public) / `http://api:80/v1` (internal, server-side only).
  - CAS was assumed enabled; this deployment has no `EXTERNAL_AUTH_*` configured and
    `LOCAL_REGISTRATION_ENABLED=false` — both flows must still be *built* (parity), just have
    nothing to point at here yet.
  - Monitor WebSocket was assumed `wss://`; this deployment is plain `http`/`ws` (no TLS yet) —
    proxied at `/ws` by the existing nginx `proxy` service, confirmed running.
  - OpenAPI spec was assumed served at `/v1/api-docs`; a live request confirms it returns 404 —
    `repos/api/docs/swagger.yaml` exists in the api repo's source tree but nginx only exposes `www/`.
    Read the file from disk at codegen time rather than fetching it over HTTP.
  Full detail and how each was checked is in `QUESTIONS.md`'s Resolved section.
  - *Observations:* Recon was thorough about the legacy **application** but hadn't yet looked at the
    **deployment** it needs to run alongside — both live in "the compose repo" per §1's operator
    inputs. Worth checking early in every future session that touches env/URLs: read `ReCOdex/.env`
    and `ReCOdex/docker-compose.yaml` directly rather than assuming.

- **[2026-08-17 20:45] F-001:** Scaffolded Next.js in `recodex-web-next/` (correct location this
  time): `tsconfig.json` (strict), `next.config.ts` (`output: 'standalone'`, `basePath` from
  `URL_PATH_PREFIX` build-time env, `cacheComponents`/`partialPrefetching` explicitly `false`),
  minimal `app/layout.tsx` + `app/page.tsx`. `npm view next version` confirms `16.3.1` really is the
  latest 16.3.x patch — already what was pinned, no change needed there.
  - *Observations:* `next build` warned that `experimental.cacheComponents` moved to a top-level
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
  - *Observations:* Two real, currently-unresolved upstream compatibility gaps on the very first
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
  - *Observations:* `docker build` succeeded on the first try, but `docker run` immediately crashed:
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
  - *Observations:* Worth remembering for every future dependency that shows this failure mode —
    "@swc/helpers as a dependency" and "outputFileTracingRoot" are both popular answers online for
    this error but were both wrong for this specific case. Diffing the traced output against the real
    pnpm store is what actually found it. If another package crashes the standalone server the same
    way later, check for a missing subdirectory in its traced copy before reaching for either of those
    two "standard" fixes again.

- **[2026-08-17 21:45] F-004:** Compose service entry. Shown to the operator as a diff first per the
  constraint-1 exception; approved as-is (see DEC-028). Applied to `ReCOdex/docker-compose.yaml` (new
  `web-next` service, `build.context: ../recodex-web-next` per DEC-026, `depends_on: [api]`), plus
  `WEB_NEXT_PORT` added to `ReCOdex/.env` and `ReCOdex/.env.example`.
  - *Observations:* `docker compose up -d web-next` failed the first time — host port `3000` (the
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
  - *Observations:* Did not route `web-next` through `proxy` (no `nginx.conf.template` change) — direct
    host-port publish is simpler for side-by-side dev with the legacy `web-app` and doesn't touch a
    working config file. Revisit when cutover is closer (see DEC-028's rejected alternative).

### Current Status

- **Phase:** Foundation (F-001/F-002/F-003/F-004/F-006 done)
- **Next ticket:** F-005 (CI pipeline) or `scripts/seed.ts` — brief's own dependency-order note says
  the seed script should land before or alongside the rest of Foundation, not after, so pick that up
  next unless BACKLOG.md's phase table says otherwise.
- **Blocked tickets:** None
- **Operator inputs pending:** Q-005 resolved (see QUESTIONS.md). Q-007 (SMTP — operator will test
  end-to-end later, proceed on `mail.debugMode` assumption per ASS-008)
