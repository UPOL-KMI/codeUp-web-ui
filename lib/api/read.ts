import "server-only";

import { forbidden, notFound } from "next/navigation";

import { ApiError, apiGet, type ApiPath, type RequestOptions } from "./client";

/**
 * The boundary between core-api's refusals and what a reader is shown (F-030).
 *
 * `apiGet` and its siblings in `./client` throw `ApiError` for every unsuccessful response, which
 * is right for a Route Handler answering JSON and for a Server Action turning a failure into a
 * form error -- but on a page's render path it means core-api answering "you may not see this"
 * arrives at the reader as `error.tsx`'s "Something went wrong", which is the one thing that did
 * not happen. These two functions map the two statuses that are not errors at all onto the pages
 * that exist for them: 403 -> `forbidden()` (`app/[locale]/forbidden.tsx`), 404 -> `notFound()`.
 *
 * Read paths only. Both interrupts work by throwing, so they belong where a throw ends a render:
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
      if (error.httpStatus === 403) forbidden();
      if (error.httpStatus === 404) notFound();
    }
    throw error;
  }
}
