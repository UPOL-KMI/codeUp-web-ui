"use client";

import { useFormContext } from "react-hook-form";
import type { FieldValues } from "react-hook-form";

/**
 * Renders RHF's `root` pseudo-field error -- a Server Action failure not tied to one specific
 * field (`ActionFailure.formError`, `lib/forms/action-result.ts`), e.g. "That email is already
 * registered" when no single input is individually invalid. Complements `TextField`'s per-field
 * error surfacing; together they cover both error shapes a Server Action can report.
 *
 * Takes an explicit `message` for the errors that belong to a control `TextField` does not cover
 * -- S-014's upload area and its environment select are the first of those. Same element, same
 * `role="alert"`, so a validation message reads identically wherever it comes from. Without a
 * `message` it falls back to `root`, and it tolerates being rendered outside a `FormProvider`
 * (`useFormContext()` returns null there) so it can sit next to a control that is not an RHF
 * field at all.
 */
export function FormError<T extends FieldValues>({ message }: { message?: string } = {}) {
  const context = useFormContext<T>();
  const resolved = message ?? context?.formState.errors.root?.message;
  if (!resolved) return null;

  return (
    <p
      role="alert"
      className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {resolved}
    </p>
  );
}
