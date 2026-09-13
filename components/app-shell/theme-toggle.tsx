"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";

const OPTIONS = ["system", "light", "dark"] as const;

const subscribeToNothing = () => () => {};

/**
 * Light, dark, or whatever the device says. next-themes only knows the stored choice after
 * hydration, so the pressed state is withheld until then rather than rendered wrong once.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const t = useTranslations("Nav.theme");
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  const current = mounted ? (theme ?? "system") : null;

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={`inline-flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5 ${className}`}
    >
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={current === option}
          onClick={() => setTheme(option)}
          title={t(option)}
          className="inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-accent aria-pressed:text-accent-foreground"
        >
          <ThemeIcon option={option} />
          <span className="sr-only">{t(option)}</span>
        </button>
      ))}
    </div>
  );
}

function ThemeIcon({ option }: { option: (typeof OPTIONS)[number] }) {
  const common = {
    className: "size-4",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": "true" as const,
  };
  switch (option) {
    case "light":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      );
    case "dark":
      return (
        <svg {...common}>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" />
        </svg>
      );
  }
}
