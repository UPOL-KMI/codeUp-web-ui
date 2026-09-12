"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";

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
export function SessionBar({ fullName }: { fullName: string }) {
  const t = useTranslations("Nav");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-3 px-4 pt-4 text-sm sm:px-6 lg:px-8">
      <span className="truncate text-muted-foreground">{fullName}</span>
      <button
        type="button"
        onClick={() => void signOut()}
        disabled={pending}
        className="rounded-md border border-input px-2.5 py-1 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        {t("signOut")}
      </button>
    </div>
  );
}
