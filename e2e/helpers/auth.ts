import type { SeedAccount } from "./accounts";
import { baseURL } from "./base-url";

export interface SessionCookie {
  readonly name: string;
  readonly value: string;
}

/**
 * Logs in via the real Auth BFF Route Handler (`app/api/auth/login/route.ts`, F-016) rather than
 * driving a login *form* -- there isn't one yet (`/login` is still F-013's `PlaceholderPage`; a
 * real form is a later Design System / Anonymous Flows ticket). This helper needs to change to
 * drive the UI once that form exists; the underlying session mechanism (the cookie) won't.
 *
 * Deliberately plain `fetch()`, not any Playwright-provided request context (`page.request`,
 * `playwright.request.newContext()`) -- both were tried first and both threw `ENOENT` reading a
 * `storageState` file that didn't exist yet, even inside the very `beforeAll` meant to create it:
 * `test.use({storageState: path})` at describe scope turns out to apply as the default for *any*
 * context Playwright creates within that scope, fixture-provided or not (confirmed live during
 * F-023 -- reproduced with both APIs, not a one-off). A plain `fetch()` sidesteps Playwright's
 * context machinery for the login step entirely, so there's nothing for that default to attach to.
 *
 * Meant to be called **once per persona** (via `test.beforeAll`), not once per test: core-api's
 * login hashes the password with bcrypt (deliberately slow), and calling this once per *route*
 * test instead of once per *persona* was enough concurrent load, under Playwright's default
 * parallel workers, to make some logins against a local dev core-api time out
 * (`ConnectTimeoutError`, observed live). The resulting cookie is meant to be injected into each
 * test's `context` via `context.addCookies()` (see `smoke.spec.ts`), not `storageState`, for the
 * same reason described above.
 */
export async function loginAndGetCookie(account: SeedAccount): Promise<SessionCookie> {
  const response = await fetch(`${baseURL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  if (!response.ok) {
    throw new Error(`login as ${account.label} (${account.email}) failed: HTTP ${response.status}`);
  }

  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error(`login as ${account.label} (${account.email}) succeeded but set no cookie`);
  }
  // Cookie name is not hardcoded here (it's `${SESSION_COOKIE_PREFIX}_session`,
  // `lib/auth/session-cookie.ts`, configurable per deployment) -- parsed generically instead so
  // this helper doesn't need to import server-only code or duplicate that env-derived value.
  const separatorIndex = setCookie.indexOf("=");
  const name = setCookie.slice(0, separatorIndex);
  const value = setCookie.slice(separatorIndex + 1).split(";")[0];
  if (!name || !value) {
    throw new Error(
      `login as ${account.label} (${account.email}) set an unparseable cookie: ${setCookie}`,
    );
  }

  return { name, value };
}
