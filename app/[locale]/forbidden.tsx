import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

// Renders when forbidden() is called (experimental.authInterrupts, see next.config.ts) --
// 403, permission denied for an authenticated user. Distinct from unauthorized.tsx (401, not
// signed in at all).
export default async function Forbidden() {
  const t = await getTranslations("Forbidden");

  return (
    <main>
      <h1>{t("title")}</h1>
      <p>{t("description")}</p>
      <Link href="/">{t("homeLink")}</Link>
    </main>
  );
}
