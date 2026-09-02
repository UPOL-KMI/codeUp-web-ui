# ReCodEx — new web frontend

A replacement frontend for [ReCodEx](https://github.com/ReCodEx), the programmer-training and
grading platform used at the Faculty of Mathematics and Physics, Charles University. It is a
Next.js 16 App Router application that talks to the same `core-api` the existing frontend does, and
it is being built to full feature parity with it before it replaces anything.

It does **not** replace or modify any other ReCodEx component. `core-api`, `worker`, `broker`,
`monitor`, `cleaner` and the legacy `web-app` are all untouched; this app is one more client of the
same API.

---

## What you need

| Thing             | Version               | Notes                                                              |
| ----------------- | --------------------- | ------------------------------------------------------------------ |
| Node              | 22 or newer           | `.nvmrc` pins 22; `nvm use` picks it up                            |
| pnpm              | via corepack          | `corepack enable` — do not `npm i -g pnpm`, the lockfile is pnpm's |
| A ReCodEx backend | running and reachable | See below. **Nothing in this app works without one**               |
| Docker            | for the backend       | Only if you are running the backend yourself                       |

There is no mock mode and no fixture server. Every screen reads real data from `core-api`, which is
a deliberate choice — see `docs/DECISIONS.md` — so the first thing to get working is the backend.

---

## Getting a backend

This repository is checked out **inside** the ReCodEx compose repository, at `repos/web-next/`, and
that compose repo is what stands the backend up. Two directories up from here is its root.

```bash
cd ../..            # the compose repo
./pull-repos.sh     # fetches the upstream ReCodEx components into repos/
cp .env.example .env
docker compose up -d
```

That gives you `core-api`, MySQL, the broker, a worker, the monitor, the legacy frontend and an
nginx in front of them. Check it answers:

```bash
curl http://localhost/api/v1
```

You should get the API's banner. If you get nothing, `docker compose logs api` is the place to look.

**A note on hostnames that will otherwise cost you an hour.** The compose stack sets
`APP_DOMAIN=recodex.local`, and `recodex.local` is not in your `/etc/hosts` unless you put it there.
Inside the compose network the services reach each other by service name; from your own machine they
are only reachable on `localhost` and the published ports. So when you run this app **outside**
Docker — which is what `pnpm dev` does — point it at `localhost`, not at `recodex.local`. Either add
the name to `/etc/hosts` or use `localhost` in `.env.local`; both work, and mixing them does not.

---

## Running this app

```bash
corepack enable
pnpm install
cp .env.example .env.local     # then read it — the comments are the documentation
pnpm dev
```

Open <http://localhost:3000>. It redirects to `/en` or `/cs` depending on your browser's
`Accept-Language`; both languages are complete and neither is a fallback for the other.

`.env.example` is not a file of placeholders. It carries the actual verified values for the compose
deployment alongside this repo, with a comment on each one explaining what it is for and what breaks
if it is wrong. Read it rather than skimming it. The two that matter most:

- **`API_BASE_INTERNAL`** — where the server (Server Components, Route Handlers, Server Actions)
  reaches `core-api`. Running bare on your host, this must be a URL your host can reach.
- **`API_BASE_PUBLIC`** — where the **browser** is told to go, for the external-auth redirect. Not
  the same value inside Docker, which is the entire reason there are two.

### Seed data

An empty instance is not much to look at, and several screens only have interesting states when
there is data in them.

```bash
pnpm seed
```

This creates groups (including an archived one, an organisational one, and one with 25 students for
paging), exercises, assignments, submissions and a set of accounts. It is idempotent — running it
twice is safe, and running it after a failed run is safe. Every account it creates is listed with
its password and its purpose in **`docs/SEED_ACCOUNTS.md`**; that file is where you find out which
account to sign in as to see a given screen.

The one account it does **not** create is the superadmin, which the deployment's own first-boot seed
makes (`admin@admin.com` / `admin`).

---

## Verifying

```bash
pnpm typecheck     # tsc --noEmit
pnpm lint          # eslint
pnpm format:check  # prettier
pnpm build         # the real check — server/client boundary and serialisation errors surface here
pnpm test          # vitest, pure logic only
pnpm test:e2e      # playwright, against your real running backend
```

The first four run in CI (`.github/workflows/ci.yml`) and are expected to pass on every commit.

**`pnpm test:e2e` is not in CI, and that is deliberate.** It needs a real, reachable `core-api`,
which a GitHub Actions runner does not have and this repository cannot stand up on its own. It runs
against a production `next build` + `next start`, not `next dev` — dev-mode behaviour is not what
ships, and this repo has already found one bug that reproduced only in a standalone build. It
creates and deletes real data on your instance; that is fine, the instance is disposable.

If it fails to connect, check that your backend is up and that `.env.local` points at it. If
individual tests time out, the usual cause is the local PHP-FPM pool rather than the tests —
`workers` is capped at 2 for that reason.

---

## How the code is laid out

```
app/
  [locale]/(anon)/   sign-in, registration, password reset, invitations — no session needed
  [locale]/(app)/    everything behind a session
  api/               the BFF: auth routes, streaming uploads and downloads, search
components/          design system (form/, dialog/, state/, status/, code/, …) + feature components
lib/
  api/               typed, server-only readers over core-api
  actions/           Server Actions, one file per domain
  auth/              session cookie, refresh, requireSession()
  breadcrumbs/       the single route→label manifest every page renders through
i18n/, messages/     next-intl; messages/{en,cs}.json are the only place user-facing text lives
e2e/                 the Playwright smoke harness and the core journeys
docs/                the project's actual memory — see below
proxy.ts             locale negotiation, session liveness, proactive token refresh
```

### Five things that are not obvious from the file names

1. **The access token never reaches client-side JavaScript.** Sign-in goes through a Route Handler
   which sets an httpOnly cookie; every server-side read attaches the token from that cookie. No
   component receives it, and a test asserts it appears nowhere in the served HTML or the client
   bundles. If you find yourself wanting the token in a component, the answer is a Server Action.

2. **It is `proxy.ts`, not `middleware.ts`.** Since Next.js 16 that is the filename and `proxy` is
   the exported function. A `middleware.ts` written from memory silently never runs — you get auth
   "protection" that does nothing and no error to tell you so.

3. **`proxy.ts` is not the authorisation boundary.** It exists to avoid flashing a page that is
   about to fail. The real boundary is `requireSession()` in the data-access layer, called by every
   function that touches `core-api`, plus `core-api`'s own ACL. A hidden button is not authorisation.

4. **Permissions come from the API, never from a role name.** Entities carry `permissionHints`; the
   UI offers an action when the hint says so. Where `core-api` publishes no hint — it happens, and
   `docs/DECISIONS.md` records each case — the conditions are restated from fields the page already
   has, and the server is still the one that decides.

5. **Every user-facing string is in both locales, in the same commit.** That includes `aria-label`,
   `title` and `sr-only` text, which are read aloud and are therefore user-facing. There are exactly
   two hardcoded-text exceptions in the tree (`app/global-error.tsx` and `app/global-not-found.tsx`),
   both because they render when the i18n machinery itself may be what failed.

---

## The `docs/` directory

This project keeps its state in the repository rather than in anyone's head. If you are picking the
work up, read them in this order:

| File               | What it answers                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| `AGENTS.md` (root) | The conventions this repo is built under. Read first, every time                                   |
| `PROGRESS.md`      | Append-only, timestamped. **Read the tail** — the last entries tell you exactly where things stand |
| `BACKLOG.md`       | The ticket queue, and what is blocked                                                              |
| `INVENTORY.md`     | The parity contract: every legacy capability, where it went, whether it is done                    |
| `DECISIONS.md`     | Why anything is the way it is. Large; grep it for a `DEC-` id rather than reading it through       |
| `QUESTIONS.md`     | Open questions and `core-api` defects found along the way                                          |
| `SEED_ACCOUNTS.md` | Which account to sign in as to see a given screen                                                  |
| `ROUTES.md`        | Old → new URL mapping, and the redirects a cutover needs                                           |
| `DROPPED.md`       | What was deliberately not carried across, and why                                                  |
| `IA.md`            | The information architecture and its reasoning                                                     |

**A specific warning about parity.** The app is feature-complete for Phases 1–6 and parity is
nevertheless **not** met: `BACKLOG.md`'s G-001..G-029 are capabilities the legacy app has and this
one does not, found by walking `INVENTORY.md` row by row. Most of them are a missing control over an
endpoint this repo already types. Do not assume a screen is finished because it renders.

---

## Deploying

The `Dockerfile` builds a `standalone` image: dependencies, then a build, then a minimal runner that
starts `node server.js` as a non-root user on port 3000.

The compose repository already has a `web-next` service pointing its build context at this
directory. It publishes the container's 3000 on `WEB_NEXT_PORT` (3001 by default, because 3000 was
taken), joins the `recodex` network so it can reach `api` directly, and passes the browser-facing
URLs built from `APP_DOMAIN`.

```bash
cd ../.. && docker compose up -d --build web-next
```

Configuration is environment variables, all documented in `.env.example`, with **one exception that
will surprise you**: `URL_PATH_PREFIX` (Next's `basePath`, mounting the app under a sub-path) is
resolved at **build** time, not run time. It is a Docker build ARG. Changing where the app is
mounted requires a rebuild, not a restart — Next offers no runtime equivalent.

### Cutting over from the legacy frontend

Not done, and not a code change. nginx currently serves the **legacy** app at `/` and this one only
on its own port, so the two do not compete for URLs. Before this app takes over `/`:

- Add the redirects in `docs/ROUTES.md`. Every new URL is locale-prefixed (`/en/dashboard`, not
  `/dashboard`), and several legacy routes became `?tab=` query parameters — a naïve path rewrite
  sends bookmarks to a 404.
- Decide whether the legacy app stays reachable somewhere. If it does, the catch-all `/app/:path*`
  redirect must not be added, or you make it unreachable through its own URLs.
- Point `core-api`'s configured frontend URL at the new app, or the links in the emails it sends
  will keep going to the old one.

---

## Known limitations of a local dev instance

These are environment limits, not bugs, and they will make some screens look wrong:

- **Evaluations cannot really pass or fail** on a cgroup v2 host, which most modern Linux and every
  Docker Desktop is. Submissions are accepted and evaluated and the result is always a failure, so
  the test-result tables and "solved" states have never rendered with real data locally.
- **No outbound SMTP is configured**, so anything that sends mail — verification, password reset,
  invitations, notifications — can be exercised only as far as the API call. Use `core-api`'s
  `mail.debugMode` / `archivingDir` to see what would have been sent.
- **Six runtime environments are installed**, so a few configuration-editor branches that only
  appear for `data-linux`, `haskell` and friends have never been rendered.

All three are recorded in `docs/QUESTIONS.md` and `docs/PROGRESS.md` with what to re-verify once you
have a host that does not have them.

---

## Licence

MIT, matching the original project. ReCodEx is developed at the Faculty of Mathematics and Physics,
Charles University — see [ReCodEx/wiki](https://github.com/ReCodEx/wiki) for the project itself.
