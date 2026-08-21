import { getTranslations } from "next-intl/server";

import { StatusState } from "@/components/state/status-state";
import { Link } from "@/i18n/navigation";

// Renders when unauthorized() is called (experimental.authInterrupts, see next.config.ts) --
// 401, not signed in. Distinct from forbidden.tsx (403, signed in but lacks permission).
// Shared layout via D-008's StatusState.
export default async function Unauthorized() {
  const t = await getTranslations("Unauthorized");

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
