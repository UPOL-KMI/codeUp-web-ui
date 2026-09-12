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
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              href="/"
              className="rounded-md border border-input px-3 py-1.5 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("homeLink")}
            </Link>
            {/* The way out of a refusal, and it has to be here: this page renders outside the app
                shell, so there is no navigation and no sign-out on it, and `proxy.ts` sends a
                signed-in visitor from `/login` to `/dashboard` -- which is itself refused when the
                refusal is the dashboard's. Without this a reader is stranded on the public front
                page with no control that changes anything. A plain link rather than the logout
                Route Handler because that one is POST by design (CSRF); this GET route clears the
                same cookie and lands on the sign-in page. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a Route Handler,
                not a page: it must be a real navigation so the response's Set-Cookie applies. */}
            <a
              href="/api/auth/session-expired"
              className="rounded-md border border-input px-3 py-1.5 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("signOutLink")}
            </a>
          </div>
        }
      />
    </main>
  );
}
