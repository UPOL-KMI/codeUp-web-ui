/**
 * The one full-page/panel state layout (D-008): "not found", "forbidden", "nothing here yet",
 * "that failed". Brief §9 requires every list and page state to be *designed* rather than
 * improvised per screen -- one component means they cannot drift apart, and a new state is a call
 * site rather than a new layout.
 *
 * Presentational and server-safe on purpose (no `"use client"`): `not-found.tsx`,
 * `forbidden.tsx` and `unauthorized.tsx` are Server Components, and only the error and empty
 * variants need interactivity, which they add by passing an `action` rather than by making this
 * whole layout client-side.
 */
export interface StatusStateProps {
  title: string;
  description?: string;
  /** Decorative; callers pass an inline SVG. Always rendered `aria-hidden` -- the title is the label. */
  icon?: React.ReactNode;
  /** A button or link: the retry, or "the action that fills it" for an empty list (brief §9). */
  action?: React.ReactNode;
  tone?: "neutral" | "danger";
}

export function StatusState({
  title,
  description,
  icon,
  action,
  tone = "neutral",
}: StatusStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center">
      {icon && (
        <span
          aria-hidden="true"
          className={tone === "danger" ? "text-destructive" : "text-muted-foreground"}
        >
          {icon}
        </span>
      )}
      <h2
        className={`text-base font-semibold ${tone === "danger" ? "text-destructive" : "text-foreground"}`}
      >
        {title}
      </h2>
      {description && <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}
