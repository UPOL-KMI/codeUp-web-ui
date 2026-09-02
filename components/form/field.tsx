"use client";

import { Children, cloneElement, isValidElement, useId } from "react";

/**
 * A labelled control with its own error line, for the inputs `TextField` does not cover -- a
 * `select`, a checkbox, a password confirmation whose message is a translation key rather than the
 * raw string RHF stores.
 *
 * The difference from `TextField` is where the error text comes from: that one reads
 * `formState.errors[name]` and renders the message verbatim, which is right when the schema's
 * messages are already prose. The schemas in this app store *keys* (`"tooShort"`, `"mismatch"`)
 * so that both locales can render them, so their forms translate the key themselves and hand the
 * result here.
 *
 * Pairs label and control by a generated `id` rather than wrapping the control in the `<label>`:
 * a wrapping label takes its whole subtree as the field's accessible name, which would fold the
 * description and the error text into the name instead of describing the field. The `id` and the
 * `aria-describedby` are put on the first element child, so no caller has to invent either.
 */
export function Field({
  label,
  description,
  error,
  children,
}: {
  label: string;
  description?: string;
  error?: string | false;
  children: React.ReactNode;
}) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  const childList = Children.toArray(children);
  const firstElement = childList.findIndex((child) => isValidElement(child));
  const controls = childList.map((child, index) =>
    index === firstElement && isValidElement(child)
      ? cloneElement(child as React.ReactElement<Record<string, unknown>>, {
          id,
          "aria-describedby": [descriptionId, errorId].filter(Boolean).join(" ") || undefined,
        })
      : child,
  );

  return (
    <div className="flex flex-col gap-1 text-sm">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {description && (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {controls}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
