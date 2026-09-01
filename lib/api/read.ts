import "server-only";

import { forbidden, notFound, redirect } from "next/navigation";

import { ApiError, apiGet, type ApiPath, type RequestOptions } from "./client";

/**
 * The boundary between core-api's refusals and what a reader is shown (F-030).
 *
 * `apiGet` and its siblings in `./client` throw `ApiError` for every unsuccessful response, which
 * is right for a Route Handler answering JSON and for a Server Action turning a failure into a
 * form error -- but on a page's render path it means core-api answering "you may not see this"
 * arrives at the reader as `error.tsx`'s "Something went wrong", which is the one thing that did
 * not happen. These two functions map the statuses that are not errors at all onto whatever exists
 * for them: 403 -> `forbidden()` (`app/[locale]/forbidden.tsx`), 404 -> `notFound()`, and 401 ->
 * the auth BFF's `session-expired` route (F-031).
 *
 * **401 is the odd one out, and cannot be a page.** core-api answering "this token is not valid"
 * means the honest response is to sign in again, and neither `unauthorized()` nor
 * `redirect("/login")` delivers that while the dead cookie is still set -- `proxy.ts` would treat
 * the reader as signed in and send them back. Clearing it is the fix, a render cannot write
 * cookies, and a Route Handler can: hence the redirect out to `/api/auth/session-expired`, which
 * clears the cookie and lands on `/login`. `proxy.ts` already handles the commoner case -- a token
 * past its own `exp` -- before anything renders, so what reaches here is core-api refusing a token
 * that still looks live: a password change's validity threshold, or an administrator invalidating
 * every token a user holds.
 *
 * Read paths only. All three interrupts work by throwing, so they belong where a throw ends a
 * render:
 * a Server Component, or a function it awaits. Route Handlers and Server Actions keep importing
 * `./client` directly -- an interrupt raised inside a JSON endpoint is not an answer its caller
 * can read, and one raised inside a Server Action is swallowed by the `catch` that builds the
 * form error, leaving the submitter with no page and no message.
 *
 * The same reason keeps a call that handles its own failure on `./client`: a `try`/`catch` around
 * an interrupt suppresses it (confirmed in `node_modules/next/dist/docs/.../forbidden.md`), so a
 * read whose 403 already means something to its caller -- an empty review queue, a parent group
 * this reader cannot see -- must not be routed through here.
 *
 * This maps status, not permission. Whether an action is offered is still decided by the
 * permission hints on the entity (AGENTS.md constraint 4); this is what happens when a reader
 * asks for something those hints never offered them.
 */
export function apiRead<T>(path: ApiPath, options?: Omit<RequestOptions, "body">): Promise<T> {
  return pageRead(apiGet<T>(path, options));
}

/** `apiRead` for a read that is already a promise -- a memoized fetcher, or a POST-shaped read. */
export async function pageRead<T>(read: Promise<T>): Promise<T> {
  try {
    return await read;
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.httpStatus === 401) redirect("/api/auth/session-expired");
      if (error.httpStatus === 403) forbidden();
      if (error.httpStatus === 404) notFound();
    }
    throw error;
  }
}
