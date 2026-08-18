"use client";

import { useFormContext } from "react-hook-form";
import type { FieldValues, Path } from "react-hook-form";

export interface TextFieldProps<T extends FieldValues> {
  name: Path<T>;
  label: string;
  type?: "text" | "email" | "password" | "number" | "search";
  placeholder?: string;
  autoComplete?: string;
  description?: string;
}

/**
 * The form kit's field component (BACKLOG.md D-004: "field, error surfacing"). Reads from RHF's
 * `useFormContext()` -- the page wraps its fields in `<FormProvider {...form}>` (`form` from
 * `useServerActionForm`), so each field only needs a `name`, not the whole form object threaded
 * through props. Covers text-shaped inputs (`text`/`email`/`password`/`number`/`search`); other
 * shapes (select, checkbox, textarea, ...) aren't built here -- add them the same way once a real
 * consumer needs one, rather than building a full input catalogue speculatively.
 *
 * Error surfacing: reads `formState.errors[name]`, ties it to the input via `aria-invalid` and
 * `aria-describedby` (not just visual proximity), consistent with the accessibility bar brief §9
 * sets ("visible focus... Radix primitives for anything with focus semantics") even though a
 * plain `<input>` doesn't need Radix itself.
 */
export function TextField<T extends FieldValues>({
  name,
  label,
  type = "text",
  placeholder,
  autoComplete,
  description,
}: TextFieldProps<T>) {
  const {
    register,
    formState: { errors },
  } = useFormContext<T>();

  const error = errors[name];
  const errorMessage = typeof error?.message === "string" ? error.message : undefined;
  const errorId = errorMessage ? `${name}-error` : undefined;
  const descriptionId = description ? `${name}-description` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {description && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
      <input
        id={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={[descriptionId, errorId].filter(Boolean).join(" ") || undefined}
        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring aria-invalid:border-destructive"
        {...register(name)}
      />
      {errorMessage && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
