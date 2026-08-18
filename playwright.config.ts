import { defineConfig, devices } from "@playwright/test";

import { PORT, baseURL } from "./e2e/helpers/base-url";

/**
 * The brief's §8 "main safety net": a smoke harness, not a test suite (see `e2e/README.md` for
 * the full rationale). Runs against a real `next build` + `next start`, not `next dev` -- dev
 * mode's extra warnings/overlay behaviour aren't representative of what ships, and this repo has
 * already found one real bug (DEC-039) that only reproduced in a production `standalone` build.
 * `next start` still loads `.env.local` (confirmed against `node_modules/next/dist/docs/...
 * environment-variables.md`: `.env.local` is skipped only when `NODE_ENV=test`, not in
 * production), so this points at the same local core-api as every other verification step in
 * this project.
 *
 * Chromium only -- this is a smoke harness against a real backend, not a cross-browser
 * compatibility suite (explicitly out of scope per brief §8's "Explicitly forbidden" list, which
 * calls out anything resembling a broad test matrix).
 *
 * Not wired into CI (`.github/workflows/ci.yml`): these tests need a real, reachable core-api
 * (brief: "against the real local API"), which GitHub Actions' `ubuntu-latest` runner doesn't
 * have and this repo has no way to stand up on its own (core-api/mysql/etc. live in the separate
 * `ReCOdex` compose repo). Meant to be run locally against the developer's own
 * `docker compose up`'d stack. See DEC-045.
 *
 * `workers: 2` -- found live, not assumed: this suite's login helper calls core-api's real
 * `/login` (bcrypt-hashes the password server-side, deliberately slow), and the default
 * CPU-core-count worker total (7 on the machine this was built on) sent enough concurrent logins
 * to a local dev `docker compose` stack's PHP-FPM pool to make some of them genuinely time out
 * (`ConnectTimeoutError` to `recodex.local:80` after core-api's real 10s fetch timeout, confirmed
 * in the Next.js server's own logs -- not a bug in this harness or in the app). A resource-
 * constrained local backend, not CI capacity, is the actual limit here.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "off", // smoke.spec.ts takes its own, deliberately-named screenshots instead
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `pnpm build && pnpm start -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
