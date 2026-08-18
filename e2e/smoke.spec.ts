import fs from "node:fs";
import path from "node:path";

import { test, expect } from "@playwright/test";
import type { ConsoleMessage, Page, Request as PWRequest } from "@playwright/test";

import { SEED_ACCOUNTS } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import type { SessionCookie } from "./helpers/auth";

const LOCALE = "en";

// The 8 `(anon)` routes from app/[locale]/(anon)/ (F-013), reachable without a session; plus the
// bare locale root (app/[locale]/page.tsx), also public per proxy.ts's PUBLIC_PATHNAMES (F-014).
const PUBLIC_ROUTES = [
  "",
  "/login",
  "/register",
  "/forgot-password",
  "/forgot-password/change",
  "/email-verification",
  "/accept-invitation",
  "/faq",
];

// The 10 `(app)` routes from app/[locale]/(app)/ (F-013), all requiring a session via proxy.ts.
const APP_ROUTES = [
  "/dashboard",
  "/groups",
  "/exercises",
  "/pipelines",
  "/profile",
  "/submission-failures",
  "/system-messages",
  "/users",
  "/admin",
  "/archive",
];

const SCREENSHOT_DIR = path.join(process.cwd(), "screenshots");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

/**
 * Fails the calling test on anything the brief's §8 safety net calls out: uncaught page errors,
 * console errors (this is also where React logs hydration mismatches -- there's no separate
 * signal for those, so a blanket console-error check already covers it), and 4xx/5xx main-frame
 * responses. Attached before `page.goto()` so nothing that happens during navigation itself is
 * missed.
 */
function watchForFailures(page: Page, routeLabel: string): void {
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") {
      throw new Error(`Console error on ${routeLabel}: ${msg.text()}`);
    }
  });
  page.on("pageerror", (err: Error) => {
    throw new Error(`Uncaught page error on ${routeLabel}: ${err.message}`);
  });
  page.on("requestfailed", (req: PWRequest) => {
    // Ignore aborted requests from navigation itself (e.g. a superseded prefetch); real failures
    // still surface via the response-status check below.
    if (req.failure()?.errorText !== "net::ERR_ABORTED") {
      throw new Error(
        `Network request failed on ${routeLabel}: ${req.url()} -- ${req.failure()?.errorText}`,
      );
    }
  });
}

async function visitAndVerify(page: Page, pathname: string, screenshotName: string): Promise<void> {
  const routeLabel = pathname || "/";
  watchForFailures(page, routeLabel);

  const response = await page.goto(`/${LOCALE}${pathname}`);
  expect(response, `navigation to ${routeLabel} produced a response`).not.toBeNull();
  expect(response!.status(), `unexpected status for ${routeLabel}`).toBeLessThan(400);

  // No dedicated "error boundary" DOM marker exists yet (no error.tsx built beyond the default),
  // so this also stands in as the "rendered error boundary" check from brief §8 -- Next's own
  // default error UI includes this phrase in both locales' fallback text.
  await expect(page.getByText(/application error/i)).toHaveCount(0);

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${screenshotName}.png`),
    fullPage: true,
  });
}

test.describe("anonymous", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`renders ${route || "/"}`, async ({ page }) => {
      await visitAndVerify(page, route, `anon-${route.replaceAll("/", "_") || "root"}`);
    });
  }
});

for (const account of SEED_ACCOUNTS) {
  test.describe(`authenticated as ${account.label}`, () => {
    // Log in once per persona, not once per route: core-api's login hashes the password with
    // bcrypt (deliberately slow), and this suite's own first version called it once per route
    // test (40 logins total across 4 personas x 10 routes) -- with Playwright's default parallel
    // workers, that concurrency spike was enough to make some logins against the local dev
    // core-api time out (`ConnectTimeoutError`, observed live). Signing in once per persona and
    // injecting the resulting cookie into each test's own context (`context.addCookies()`, in
    // `beforeEach` below) avoids the repeated cost -- and, unlike `test.use({storageState})`
    // (tried first), doesn't risk a describe-scoped default silently applying to unrelated
    // context creation elsewhere (see `helpers/auth.ts`'s doc comment).
    let cookie: SessionCookie;

    test.beforeAll(async () => {
      cookie = await loginAndGetCookie(account);
    });

    test.beforeEach(async ({ context }) => {
      await context.addCookies([
        { name: cookie.name, value: cookie.value, url: baseURL, httpOnly: true },
      ]);
    });

    for (const route of APP_ROUTES) {
      test(`renders ${route}`, async ({ page }) => {
        await visitAndVerify(page, route, `${account.label}-${route.replaceAll("/", "_")}`);
      });
    }
  });
}
