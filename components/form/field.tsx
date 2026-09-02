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
 * Wraps its control in the `<label>` rather than pairing them by `id`, so no caller has to invent
 * a unique one.
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
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {description && <span className="text-xs text-muted-foreground">{description}</span>}
      {children}
      {error && (
        <span role="alert" className="text-sm text-destructive">
          {error}
        </span>
      )}
    </label>
  );
}
