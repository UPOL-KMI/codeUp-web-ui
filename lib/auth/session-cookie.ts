import "server-only";

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
