"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Toast } from "radix-ui";
import { useTranslations } from "next-intl";

/**
 * The one toast system (D-007). Brief §9: "One toast system; every mutation reports success and
 * failure. No silent failures, ever." -- so this is mounted once in the root layout and reached
 * through `useToast()`, rather than each screen rendering its own notification surface.
 *
 * On Radix's `Toast` primitive, same family as D-006's dialogs (DEC-054). Radix is doing real work
 * here, not just styling: it renders `role="status"` with `aria-live` chosen by toast type
 * (`assertive` for foreground, `polite` for background -- read out of the installed
 * `@radix-ui/react-toast@1.2.23`), keeps a swipe-to-dismiss gesture, pauses the auto-dismiss timer
 * on hover and on window blur, and -- the part worth having a library for -- provides the F8
 * hotkey and focus-region behaviour that make toasts reachable by keyboard at all.
 *
 * Toasts are transient by design, so this state is intentionally not persisted, not synced across
 * tabs, and not restored on navigation. A message that matters after a reload is not a toast.
 */

export type ToastVariant = "success" | "warning" | "error";

interface ToastItem {
  id: number;
  variant: ToastVariant;
  title: string;
  description?: string;
}

interface ToastApi {
  success: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/**
 * Errors stay up for twice as long as successes and are announced assertively: a success is a
 * confirmation the user already expects, an error is news they have to act on. A warning is news
 * too -- something was saved, but not the way the reader probably meant -- so it is announced the
 * same way and sits between the two. `duration` is per-toast in Radix, so this needs no separate
 * provider.
 */
const DURATION_MS: Record<ToastVariant, number> = { success: 4000, warning: 6000, error: 8000 };

/**
 * **Each tone is its own colour, because "it worked" and "it did not" must not look alike.** Both
 * used to arrive as the same white card with only the wording to tell them apart, which asks a
 * reader to read a message they have already half-dismissed. The surfaces are opaque tokens
 * (PF-026): a toast floats over the page, so a `/10` tint would have the page reading through it.
 */
const TONE: Record<ToastVariant, string> = {
  success: "border-success bg-success-surface",
  warning: "border-warning bg-warning-surface",
  error: "border-destructive bg-destructive-surface",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Toast");
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((variant: ToastVariant, title: string, description?: string) => {
    // Date.now() would collide for two toasts pushed in the same millisecond (a Promise.all of
    // mutations does exactly that); a counter cannot.
    setToasts((current) => [
      ...current,
      { id: (current.at(-1)?.id ?? 0) + 1, variant, title, description },
    ]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, description) => push("success", title, description),
      warning: (title, description) => push("warning", title, description),
      error: (title, description) => push("error", title, description),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      <Toast.Provider swipeDirection="right">
        {children}

        {toasts.map((item) => (
          <Toast.Root
            key={item.id}
            type={item.variant === "success" ? "background" : "foreground"}
            duration={DURATION_MS[item.variant]}
            onOpenChange={(open) => {
              if (!open) setToasts((current) => current.filter((t) => t.id !== item.id));
            }}
            data-slot="toast"
            className={`flex items-start gap-3 rounded-md border p-4 text-foreground shadow-lg data-[state=closed]:animate-toast-out data-[state=open]:animate-toast-in ${TONE[item.variant]}`}
          >
            <div className="flex min-w-0 flex-col gap-1">
              <Toast.Title className="text-sm font-medium">{item.title}</Toast.Title>
              {item.description && (
                <Toast.Description className="text-sm text-muted-foreground">
                  {item.description}
                </Toast.Description>
              )}
            </div>
            <Toast.Close
              aria-label={t("close")}
              className="ml-auto rounded-md p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
              >
                <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
              </svg>
            </Toast.Close>
          </Toast.Root>
        ))}

        <Toast.Viewport
          label={t("regionLabel")}
          className="fixed right-0 bottom-0 z-[100] flex w-full max-w-sm flex-col gap-2 p-4 outline-none"
        />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

/**
 * Throws rather than returning a no-op when the provider is missing: a toast that silently does
 * nothing is precisely the "silent failure" brief §9 forbids, and it would only be noticed in
 * production, on the error path, by the user.
 */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast() must be used inside <ToastProvider>.");
  return api;
}
