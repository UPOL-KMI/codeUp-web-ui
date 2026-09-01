import { LocaleSwitch } from "@/components/app-shell/locale-switch";

/**
 * Shared shell for pages reachable without a session (login, register, password reset, FAQ, ...).
 * Deliberately close to a passthrough -- D-series (Design System) owns the actual centered-card
 * chrome; this file is the place a later ticket edits, not something to pre-build speculatively.
 *
 * The one thing it does carry is the `<main>` landmark. `(app)`'s shell has always had one
 * (`components/app-shell/app-shell.tsx`) and every anonymous page was missing it -- found by
 * S-024's spec reaching for `getByRole("main")` on a page outside that shell.
 *
 * The language switch (A-008) is the second: a visitor has no sidebar to put it in, and the sign-in
 * page is exactly where somebody who reads Czech should be able to say so.
 */
export default function AnonLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="flex justify-end px-4 pt-4">
        <LocaleSwitch />
      </div>
      <main>{children}</main>
    </>
  );
}
