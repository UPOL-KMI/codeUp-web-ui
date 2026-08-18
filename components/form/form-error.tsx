"use client";

import { useFormContext } from "react-hook-form";
import type { FieldValues } from "react-hook-form";

/**
 * Renders RHF's `root` pseudo-field error -- a Server Action failure not tied to one specific
 * field (`ActionFailure.formError`, `lib/forms/action-result.ts`), e.g. "That email is already
 * registered" when no single input is individually invalid. Complements `TextField`'s per-field
 * error surfacing; together they cover both error shapes a Server Action can report.
 */
export function FormError<T extends FieldValues>() {
  const {
    formState: { errors },
  } = useFormContext<T>();

  const message = errors.root?.message;
  if (!message) return null;

  return (
    <p
      role="alert"
      className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </p>
  );
}
