import { test, expect } from "@playwright/test";
import type { BrowserContext } from "@playwright/test";

import { STUDENT } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * What happens when the session outlives its token (F-031).
 *
 * There are two ways it dies and they fail in different places, so both are here. A token past its
 * own `exp` is visible to `proxy.ts`, which clears it before anything renders. A token whose `exp`
 * has *not* passed but which core-api refuses -- a password change sets a validity threshold
 * (S-022), an administrator can invalidate every token a user holds -- is invisible until a real
 * call comes back `401`, on a page already rendering, which is why that one leaves through
 * `/api/auth/session-expired`.
 *
 * **The strongest assertion here is that `page.goto()` returns at all.** Before this ticket a dead
 * cookie was an infinite redirect loop: `requireSession()` sent the reader to `/login`, `proxy.ts`
 * saw a cookie and sent them back to `/dashboard`, forever. The browser's answer to that is
 * `ERR_TOO_MANY_REDIRECTS`, which fails `goto` outright -- so every navigation below is itself the
 * regression test.
 *
 * The tokens are hand-built. Neither the app nor this suite can sign one core-api would accept,
 * and neither needs to: the cookie's signature is never verified locally (`lib/auth/jwt.ts`), so a
 * payload with the right `exp` reproduces exactly the state being tested.
 */
function sessionToken(claims: { sub: string; exp: number }): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ typ: "JWT", alg: "HS256" })}.${encode(claims)}.not-a-real-signature`;
}

/** The seeded student's own id, taken from a real login rather than hardcoded. */
async function studentId(): Promise<string> {
  const { value } = await loginAndGetCookie(STUDENT);
  const payload = JSON.parse(
    Buffer.from(value.split(".")[1]!, "base64url").toString("utf8"),
  ) as unknown as { sub: string };
  return payload.sub;
}

async function setSession(context: BrowserContext, value: string): Promise<void> {
  const { name } = await loginAndGetCookie(STUDENT);
  await context.clearCookies();
  await context.addCookies([{ name, value, url: baseURL }]);
}

async function sessionCookieNames(context: BrowserContext): Promise<string[]> {
  const { name } = await loginAndGetCookie(STUDENT);
  return (await context.cookies()).filter((cookie) => cookie.name === name).map((c) => c.name);
}

test("a session past its own expiry lands on the login page, not in a redirect loop", async ({
  page,
  context,
}) => {
  const sub = await studentId();
  await setSession(context, sessionToken({ sub, exp: Math.floor(Date.now() / 1000) - 3600 }));

  await page.goto("/en/dashboard");

  await expect(page).toHaveURL(/\/en\/login\?from=/);
  // Cleared, not merely ignored -- an ignored one would send the next navigation round again.
  expect(await sessionCookieNames(context)).toEqual([]);
});

test("a session core-api refuses ends the same way, from the render path", async ({
  page,
  context,
}) => {
  // `exp` in the future, so `proxy.ts` and `requireSession()` both accept it and the refusal can
  // only come from core-api itself -- the case `/api/auth/session-expired` exists for.
  const sub = await studentId();
  await setSession(context, sessionToken({ sub, exp: Math.floor(Date.now() / 1000) + 604800 }));

  await page.goto("/en/dashboard");

  await expect(page).toHaveURL(/\/en\/login$/);
  expect(await sessionCookieNames(context)).toEqual([]);
  // Not the error boundary: signing in again is something the reader can actually do.
  await expect(page.getByText("Something went wrong")).toHaveCount(0);
});

test("a live session is left alone", async ({ page, context }) => {
  const cookie = await loginAndGetCookie(STUDENT);
  await context.addCookies([{ ...cookie, url: baseURL }]);

  await page.goto("/en/dashboard");

  await expect(page).toHaveURL(/\/en\/dashboard$/);
  expect(await sessionCookieNames(context)).toEqual([cookie.name]);
});
