import { getTranslations } from "next-intl/server";

import { StatusState } from "@/components/state/status-state";
import { Link } from "@/i18n/navigation";

// Renders when forbidden() is called (experimental.authInterrupts, see next.config.ts) --
// 403, permission denied for an authenticated user. Distinct from unauthorized.tsx (401, not
// signed in at all). Shared layout via D-008's StatusState.
export default async function Forbidden() {
  const t = await getTranslations("Forbidden");

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <StatusState
        title={t("title")}
        description={t("description")}
        action={
          <Link
            href="/"
            className="rounded-md border border-input px-3 py-1.5 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("homeLink")}
          </Link>
        }
      />
    </main>
  );
}
