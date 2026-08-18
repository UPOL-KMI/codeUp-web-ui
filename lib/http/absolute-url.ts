import "server-only";

/**
 * Builds an absolute URL for a redirect from inside a Route Handler, using the request's own
 * `Host` header rather than `request.url`.
 *
 * `request.url` is unreliable under `output: standalone` (confirmed live, DEC-039): it reflects
 * the server's own internal bind address (`HOSTNAME`/`PORT` from the Dockerfile, e.g.
 * "0.0.0.0:3000"), not the address the request actually arrived on. `Host` was confirmed correct
 * in the same live check. A bare relative path doesn't work as a substitute either --
 * `NextResponse.redirect()` throws ("Please use only absolute URLs") despite its parameter being
 * typed to accept a plain string, also confirmed live.
 *
 * `pathname` should start with `/`. Falls back to `API_BASE_PUBLIC`'s own host/protocol if `Host`
 * is somehow absent (it shouldn't be, on any real HTTP request).
 */
export function buildAbsoluteUrl(request: Request, pathname: string): string {
  const fallback = new URL(process.env.API_BASE_PUBLIC ?? "http://localhost");
  const host = request.headers.get("host") ?? fallback.host;
  const protocol = fallback.protocol;

  return `${protocol}//${host}${pathname}`;
}
