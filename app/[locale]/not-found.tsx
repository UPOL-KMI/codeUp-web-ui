import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

// Renders for notFound() calls within the [locale] segment, and for any locale-prefixed URL
// that doesn't match a route (proxy.ts redirects unprefixed paths into a locale first, so this
// covers the realistic "unmatched URL" case -- see docs/DECISIONS.md for why global-not-found.js
// wasn't added on top of this).
export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <main>
      <h1>{t("title")}</h1>
      <p>{t("description")}</p>
      <Link href="/">{t("homeLink")}</Link>
    </main>
  );
}
