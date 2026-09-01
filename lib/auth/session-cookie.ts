import "server-only";
import { cookies } from "next/headers";

import { decodeJwtPayload } from "./jwt";

// proxy.ts (F-014) only needs the *name*, to check presence for its UX redirect. This file also
// holds sessionCookieOptions() (F-016), so every place that sets or reasons about this cookie's
// shape goes through the same two exports and can't drift apart.
export const SESSION_COOKIE_NAME = `${process.env.SESSION_COOKIE_PREFIX ?? "recodex"}_session`;

/**
 * The one place the `secure` flag can be wrong (brief §5): `secure: true` on a plain `http://`
 * deployment makes the browser silently drop the cookie, so login *looks* like it succeeded while
 * never actually signing anyone in -- a confusing failure mode the brief explicitly warns not to
 * waste time debugging blind. `NODE_ENV === "production"` is the wrong signal here: this
 * deployment can (and currently does -- see the compose repo's README.md) run "in production" over
 * plain HTTP with no TLS certificate yet. `API_BASE_PUBLIC`'s own scheme is the actual ground truth
 * for whether this deployment is reachable over HTTPS (confirmed nginx forwards `X-Forwarded-Proto`
 * consistently with it -- see the compose repo's services/proxy/nginx.conf.template), and it's already a
 * required env var (F-006), so no new one is needed.
 */
export function sessionCookieOptions(maxAgeSeconds?: number) {
  const secure = new URL(process.env.API_BASE_PUBLIC ?? "http://localhost").protocol === "https:";

  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    ...(maxAgeSeconds !== undefined && { maxAge: maxAgeSeconds }),
  };
}

/**
 * Decodes an access token from core-api and sets it as the session cookie, sized to the token's
 * own `exp`. Shared by every Route Handler that receives a fresh token from core-api and needs to
 * establish a session from it (login, F-016; the external-auth callback, F-019) -- extracted here
 * once a second call site needed the exact same decode-then-set sequence, matching how
 * `decodeJwtPayload` itself was extracted into `jwt.ts` for the same reason. Returns false (and
 * sets nothing) if the token isn't a JWT this app can read the expiry of -- callers should treat
 * that as a hard failure, not silently proceed with a cookie whose lifetime can't be reasoned
 * about.
 */
export async function establishSession(accessToken: string): Promise<boolean> {
  const claims = decodeJwtPayload(accessToken);
  if (!claims) return false;

  const maxAgeSeconds = Math.max(0, Math.floor(claims.exp - Date.now() / 1000));
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, accessToken, sessionCookieOptions(maxAgeSeconds));
  return true;
}

/**
 * Whether this cookie value is still a token worth presenting to core-api (F-031).
 *
 * **A present-but-dead cookie is worse than no cookie at all**, which is why this exists as its
 * own exported predicate rather than living inside `requireSession()`. `proxy.ts` used to test
 * only for *presence*: a session past its `exp` therefore counted as signed in, so `/login` was
 * bounced to `/dashboard`, whose `requireSession()` redirected to `/login`, which bounced back --
 * an actual infinite redirect loop, reproduced with `curl` before this function existed. Both
 * layers now ask the same question of the same value, so they cannot disagree about it.
 *
 * Signature is not verified, for the reason `jwt.ts` gives: this app set the cookie from a token
 * core-api handed it. core-api remains the authority on whether a *live-looking* token is
 * actually still accepted -- it can refuse one whose `exp` has not passed (a password change sets
 * a validity threshold, S-022) and that answer arrives as a 401 on a real call, which
 * `lib/api/read.ts` routes to `/api/auth/session-expired`.
 */
export function isSessionTokenLive(value: string): boolean {
  const claims = decodeJwtPayload(value);
  return claims !== null && claims.exp * 1000 > Date.now();
}

/**
 * Reads the session token without `requireSession()`'s redirect. Route Handlers invoked by
 * client-side `fetch()` (the auth module's restricted-token route, the upload proxy routes) must
 * answer with a JSON 401 the caller can branch on -- a `redirect("/login")` there would be
 * followed by `fetch` and hand the caller a 200 page of HTML instead of a recognisable failure.
 * Server Components and Server Actions keep using `requireSession()`; this is deliberately not a
 * general-purpose "is the user logged in" helper.
 */
export async function readSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}
