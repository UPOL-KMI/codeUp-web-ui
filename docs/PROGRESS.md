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

### Current Status

- **Phase:** Foundation (F-001, resuming after correction)
- **Next ticket:** F-001 (Scaffold Next.js 16.3 repo) — continuing properly in `recodex-web-next/`
- **Blocked tickets:** None
- **Operator inputs pending:** Q-005 (port — still open, no strong preference given), Q-007 (SMTP —
  operator will test end-to-end later, proceed on `mail.debugMode` assumption per ASS-008)
