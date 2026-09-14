import type { ComponentProps } from "react";

export type ButtonVariant =
  | "primary"
  | "outline"
  | "ghost"
  | "destructive"
  | "destructive-outline"
  | "destructive-subtle"
  | "success-subtle"
  | "warning-outline";

export type ButtonSize = "xs" | "sm" | "md";

const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 aria-disabled:opacity-60";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
  outline: "border border-input bg-background text-foreground hover:bg-accent/60",
  ghost: "text-foreground hover:bg-accent/60",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  "destructive-outline": "border border-destructive text-destructive hover:bg-destructive/10",
  // Coloured ground rather than a bordered outline: where several verdict buttons sit in one row,
  // an outline reads as "one of a set" and the operator could not tell at a glance which of them
  // takes points away and which gives them. The `-surface` washes are opaque, so these stay legible
  // over a card as well as over the page.
  "destructive-subtle":
    "border border-destructive/40 bg-destructive-surface text-destructive hover:bg-destructive/15",
  "success-subtle": "border border-success/40 bg-success-surface text-success hover:bg-success/15",
  "warning-outline": "border border-warning text-warning hover:bg-warning/10",
};

const SIZES: Record<ButtonSize, string> = {
  xs: "px-2 py-1 text-xs",
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
};

/**
 * The one set of button classes (D-017). A `<Link>` that looks like a button takes these
 * directly; a real `<button>` takes `Button` below. Anything else on the element -- `w-full`,
 * `self-start`, a margin -- goes in `className` and is appended, never merged.
 */
export function buttonClasses(
  variant: ButtonVariant = "outline",
  size: ButtonSize = "sm",
  className = "",
): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}${className ? ` ${className}` : ""}`;
}

export function Button({
  variant = "outline",
  size = "sm",
  className = "",
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}
