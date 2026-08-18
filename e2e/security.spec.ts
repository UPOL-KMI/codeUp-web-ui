import { test, expect } from "@playwright/test";
import type { Response as PWResponse } from "@playwright/test";

import { STUDENT } from "./helpers/accounts";
import { APP_ROUTES } from "./helpers/routes";

const LOCALE = "en";

/**
 * The brief's §8 "one security test, non-negotiable": assert the auth cookie is httpOnly, and
 * that the raw token appears nowhere in served HTML or client bundles. Uses `page.request.post()`
 * for login (not `smoke.spec.ts`'s `loginAndGetCookie()` + `context.addCookies()`) deliberately:
 * this test needs to inspect the cookie *as the server actually set it* -- flags included -- not a
 * manually reconstructed one, so it has to go through a real browser-context request whose
 * `Set-Cookie` response Playwright parses itself.
 *
 * Finds the session cookie by diffing `context.cookies()` before/after login rather than assuming
 * its name (`${SESSION_COOKIE_PREFIX}_session`, deployment-configurable, `lib/auth/session-cookie.ts`)
 * or its shape -- robust to either changing without this test silently stopping to check anything.
 */
test.describe("token leakage (brief §8, non-negotiable)", () => {
  test("session cookie is httpOnly", async ({ page, context }) => {
    const before = await context.cookies();
    const response = await page.request.post("/api/auth/login", {
      data: { email: STUDENT.email, password: STUDENT.password },
    });
    expect(response.ok()).toBeTruthy();

    const after = await context.cookies();
    const beforeNames = new Set(before.map((c) => c.name));
    const newCookies = after.filter((c) => !beforeNames.has(c.name));

    expect(newCookies.length, "login should set exactly one new cookie").toBe(1);
    const sessionCookie = newCookies[0]!;

    expect(sessionCookie.httpOnly, `cookie '${sessionCookie.name}' must be httpOnly`).toBe(true);

    // The practical consequence of httpOnly, not just the flag: page JS genuinely cannot read it.
    await page.goto(`/${LOCALE}/dashboard`);
    const jsVisibleCookie = await page.evaluate(() => document.cookie);
    expect(jsVisibleCookie).not.toContain(sessionCookie.value);
  });

  test("raw token appears in no served HTML and no JS bundle", async ({ page }) => {
    const response = await page.request.post("/api/auth/login", {
      data: { email: STUDENT.email, password: STUDENT.password },
    });
    expect(response.ok()).toBeTruthy();
    const setCookie = response.headers()["set-cookie"];
    expect(setCookie, "login response must set a cookie").toBeTruthy();
    const separatorIndex = setCookie!.indexOf("=");
    const token = setCookie!.slice(separatorIndex + 1).split(";")[0]!;
    expect(token.length, "sanity check: token should be a real, non-trivial value").toBeGreaterThan(
      20,
    );

    const jsBundleBodies: Promise<string>[] = [];
    page.on("response", (res: PWResponse) => {
      const contentType = res.headers()["content-type"] ?? "";
      if (contentType.includes("javascript")) {
        // best-effort: a handful of chunks may 304/abort under navigation churn
        jsBundleBodies.push(res.text().catch(() => ""));
      }
    });

    for (const route of APP_ROUTES) {
      await page.goto(`/${LOCALE}${route}`);
      const html = await page.content();
      expect(html, `token leaked into HTML of ${route}`).not.toContain(token);
    }

    const bodies = await Promise.all(jsBundleBodies);
    expect(
      bodies.length,
      "sanity check: at least some JS bundles should have been observed",
    ).toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body, "token leaked into a served JS bundle").not.toContain(token);
    }
  });
});
