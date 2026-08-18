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
 * deployment can (and currently does -- see ../ReCOdex/README.md) run "in production" over plain
 * HTTP with no TLS certificate yet. `API_BASE_PUBLIC`'s own scheme is the actual ground truth for
 * whether this deployment is reachable over HTTPS (confirmed nginx forwards `X-Forwarded-Proto`
 * consistently with it -- see ../ReCOdex/services/proxy/nginx.conf.template), and it's already a
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
