import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

// Renders when unauthorized() is called (experimental.authInterrupts, see next.config.ts) --
// 401, not signed in. Distinct from forbidden.tsx (403, signed in but lacks permission).
// F-016+ (auth BFF) will point failed session checks here instead of a bare home-page link.
export default async function Unauthorized() {
  const t = await getTranslations("Unauthorized");

  return (
    <main>
      <h1>{t("title")}</h1>
      <p>{t("description")}</p>
      <Link href="/">{t("homeLink")}</Link>
    </main>
  );
}
