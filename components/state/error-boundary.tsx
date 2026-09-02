"use client";

import { catchError, type ErrorInfo } from "next/error";

import { ErrorState } from "./error-state";

/**
 * Component-level error boundary (D-008), for the case `error.tsx` cannot cover: one panel on a
 * page failing without taking the whole route down with it -- a dashboard widget, a sidebar list,
 * one tab's contents.
 *
 * Built on `catchError` from `next/error` (verified present in the installed next@16.3.1, not
 * assumed from the brief's word), which is what AGENTS.md footgun 8 calls for over a hand-written
 * React error boundary. The difference is not cosmetic: `redirect()` and `notFound()` are
 * implemented by throwing, so a naive boundary swallows them and turns a redirect into an error
 * screen; `catchError` lets those through, clears itself on client navigation, and runs `retry()`
 * inside a Transition so client state *outside* the boundary survives the retry.
 *
 * Usage: wrap the fallible subtree. `error.tsx` remains the right tool for a whole route segment.
 */
// Props type is a concrete object rather than `Record<string, never>`: `catchError` returns
// `ComponentType<P & {children?: ReactNode}>`, and a `never`-valued index signature makes that
// intersection reject its own `children`.
export const ErrorBoundary = catchError(
  ({ headingLevel }: { headingLevel?: 2 | 3 | 4 }, { retry }: ErrorInfo) => (
    <ErrorState retry={retry} headingLevel={headingLevel} />
  ),
);
