"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import type { DefaultValues, FieldValues, Path, Resolver, UseFormReturn } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import type { ActionResult } from "./action-result";

export interface UseServerActionFormOptions<TFieldValues extends FieldValues, Result> {
  /**
   * Any Standard Schema, which in this repo means a `zod/mini` schema (PF-004).
   *
   * Typed against the *spec* rather than against Zod so the resolver never has to care which
   * validator produced it -- and so the switch from `zod` to `zod/mini`, which cut 45 kB brotli
   * off twelve routes, needed no change here beyond the import.
   */
  schema: StandardSchemaV1<TFieldValues>;
  defaultValues: DefaultValues<TFieldValues>;
  /** The Server Action itself (an imported `"use server"` function) -- called directly as a
   *  function, not via `<form action>`, since React Hook Form already owns form submission. */
  action: (values: TFieldValues) => Promise<ActionResult<Result>>;
  onSuccess?: (data: Result) => void;
}

export interface UseServerActionFormResult<TFieldValues extends FieldValues> {
  form: UseFormReturn<TFieldValues>;
  onSubmit: (event?: React.BaseSyntheticEvent) => Promise<void>;
  /** True while either client-side validation+submission or the Server Action call itself is in
   *  flight -- `formState.isSubmitting` alone wouldn't cover the `startTransition`-wrapped action
   *  call below, since that dispatch happens after `handleSubmit`'s own promise would resolve. */
  isPending: boolean;
}

/**
 * The form kit's entry point (brief §4/§9/§10: "React Hook Form + Zod (shared schema), submitting
 * through a Server Action"; BACKLOG.md D-004: "field, error surfacing, pending state, dirty
 * guard"). Wires `useForm` to a Zod schema via `zodResolver` (client-side validation -- a head
 * start, not the authority: brief §6's own words, "every Server Action re-validates input with
 * Zod... A Server Action is a public HTTP endpoint that happens to have nice syntax"), then calls
 * the given Server Action directly as a function from `handleSubmit`'s callback, not via `<form
 * action>` -- React Hook Form already owns submission (validation, dirty/touched tracking,
 * `handleSubmit`'s own event handling), so layering Next's native `<form action>`/`useActionState`
 * on top would just be two systems fighting over the same submit event. The action dispatch itself
 * is wrapped in `startTransition`, per Next's own bundled guidance (`server-actions.md`: "invoked
 * from a form,... or a client-side transition") for a Server Action called outside `<form
 * action>`/`formAction`.
 *
 * Server-side failures map back onto the form via RHF's own error model: `fieldErrors` become
 * per-field errors (`form.setError(name, {message})`), `formError` becomes RHF's `root` pseudo-
 * field (a genuinely supported, not invented, RHF concept -- confirmed in
 * `node_modules/react-hook-form/dist/types/errors.d.ts`), rendered by whichever component chooses
 * to read `form.formState.errors.root`.
 *
 * **The `schema` passed here cannot live in the same file as the `"use server"` action** -- found
 * live, not from a doc: a `"use server"` file's compiler pass only handles (async) function
 * exports; a plain `z.object(...)` co-located there is silently replaced with something
 * the resolver rejects at runtime ("Invalid input: not a Zod schema", confirmed
 * reproducing and fixing this during D-004's own verification). Put the schema in its own plain module and import
 * it from both the client form and the action file -- which is what "shared schema" in the brief's
 * own phrasing meant anyway.
 */
export function useServerActionForm<TFieldValues extends FieldValues, Result>({
  schema,
  defaultValues,
  action,
  onSuccess,
}: UseServerActionFormOptions<TFieldValues, Result>): UseServerActionFormResult<TFieldValues> {
  const form = useForm<TFieldValues>({
    // Cast for the same variance limitation the `zodResolver` version had: TypeScript cannot
    // unify the resolver's own generics with this function's `TFieldValues` when one generic
    // function calls another through a schema-derived type. `schema` is
    // `StandardSchemaV1<TFieldValues>` by this function's signature, so what it produces does
    // validate into `TFieldValues`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see comment above
    resolver: standardSchemaResolver(schema as any) as unknown as Resolver<TFieldValues>,
    defaultValues,
  });
  const [isPending, startTransition] = useTransition();

  const onSubmit = form.handleSubmit((values) => {
    return new Promise<void>((resolve) => {
      startTransition(() => {
        void (async () => {
          try {
            const result = await action(values);
            if (result.success) {
              onSuccess?.(result.data);
            } else {
              if (result.formError) {
                form.setError("root" as Path<TFieldValues>, { message: result.formError });
              }
              if (result.fieldErrors) {
                for (const [field, message] of Object.entries(result.fieldErrors)) {
                  form.setError(field as Path<TFieldValues>, { message });
                }
              }
            }
          } finally {
            resolve();
          }
        })();
      });
    });
  });

  return { form, onSubmit, isPending: isPending || form.formState.isSubmitting };
}
