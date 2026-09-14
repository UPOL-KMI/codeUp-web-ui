"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Link, useRouter } from "@/i18n/navigation";
import { buttonClasses } from "@/components/button";

/**
 * Who is signed in, and the way out (top right of every page in the shell).
 *
 * **The shell has no header by design (DEC-115)**, so until now signing out lived only on the
 * account screen -- and the operator's first hour of testing found exactly that: no way out from
 * anywhere they were actually looking. This is the smallest thing that fixes it, a right-aligned
 * strip rather than the header DEC-115 declined: it carries no navigation and competes with no
 * page's own heading.
 *
 * The logout Route Handler is POST by design (CSRF), which is why this is a client component and
 * not a link. `router.refresh()` after the redirect discards the server-rendered tree the old
 * session produced; without it the shell keeps rendering the previous reader's sidebar until
 * something else invalidates it.
 */
/** The first letter of the first and the last word -- enough to read as a person, not a label. */
function initials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function SessionBar({
  fullName,
  takenOver,
}: {
  fullName: string;
  /** An administrator is signed in as somebody else and their own token is waiting (PF-025). */
  takenOver: boolean;
}) {
  const t = useTranslations("Nav");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function returnToOwnAccount() {
    setPending(true);
    const response = await fetch("/api/auth/takeover/return", { method: "POST" }).catch(
      () => undefined,
    );
    setPending(false);
    // A stash that has expired leaves nothing to return to, and the route has already cleared it,
    // so the honest next step is signing in rather than pretending the click did something.
    router.push(response?.ok ? "/dashboard" : "/login");
    router.refresh();
  }

  async function signOut() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-3 px-4 pt-4 text-sm sm:px-6 lg:px-8">
      <Link
        href="/profile"
        className="inline-flex max-w-64 items-center gap-2 rounded-full border border-border bg-card py-0.5 pr-3 pl-0.5 text-muted-foreground outline-none transition-colors hover:border-primary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          aria-hidden="true"
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[0.7rem] font-semibold text-primary-foreground"
        >
          {initials(fullName)}
        </span>
        <span className="truncate">{fullName}</span>
      </Link>
      {takenOver && (
        <button
          type="button"
          onClick={() => void returnToOwnAccount()}
          disabled={pending}
          className={buttonClasses("warning-outline", "sm")}
        >
          {t("returnToOwnAccount")}
        </button>
      )}
      <button
        type="button"
        onClick={() => void signOut()}
        disabled={pending}
        className={buttonClasses("outline", "sm")}
      >
        {t("signOut")}
      </button>
    </div>
  );
}
