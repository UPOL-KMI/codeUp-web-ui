/**
 * The badge primitive (D-011). Every status surface in the app renders through this, so a
 * "correct" solution looks the same in a table row, on a detail page and in a dashboard tile --
 * brief §9's consistency bar, which is about *not* letting each screen invent its own colouring.
 *
 * Tone is deliberately a small closed set rather than a colour: callers name what the state
 * *means*, and this file decides what that looks like. Tokens only, never a hardcoded colour, so
 * it follows the theme (brief §9).
 */
export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/15 text-destructive",
  info: "bg-accent text-accent-foreground",
};

export function Badge({
  tone = "neutral",
  children,
  title,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  /** Native tooltip for the longer explanation, when the label has to stay short. */
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
