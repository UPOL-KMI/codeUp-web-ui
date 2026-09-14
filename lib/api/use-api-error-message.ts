"use client";

import { useTranslations } from "next-intl";

/** What the Auth BFF routes return when core-api refuses: its machine code, never its sentence. */
export interface ApiErrorBody {
  code?: string;
}

/**
 * Turns core-api's error into something a Czech reader can read.
 *
 * Every error core-api raises carries a stable machine code beside the message —
 * `{error: {message, code}}`, the codes enumerated in its own `FrontendErrorMappings` — and **the
 * message is English only**. Showing it verbatim is how "The username or password is incorrect."
 * reached a reader who had chosen Czech. The code is the translatable half, so it is the half that
 * travels: the BFF routes pass `error.code` through and drop the sentence, and this hook renders it
 * from `ApiErrors` in the message catalogue.
 *
 * A code with no entry falls back to the caller's own sentence rather than to the API's — most
 * codes are things a reader can do nothing about, and the form's own wording is at least in their
 * language. Add an entry when a code says something the generic sentence does not.
 *
 * The fallback is generic so that a toast, whose detail line is optional, can pass `undefined` and
 * get a detail only when there is a translated one to show.
 */
export function useApiErrorMessage(): <Fallback extends string | undefined>(
  code: string | undefined,
  fallback: Fallback,
) => string | Fallback {
  const t = useTranslations("ApiErrors");
  return (code, fallback) => (code !== undefined && t.has(code) ? t(code) : fallback);
}
