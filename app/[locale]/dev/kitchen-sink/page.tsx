import { getTranslations } from "next-intl/server";

import { KitchenSink } from "@/components/dev/kitchen-sink";
import { PageShell } from "@/components/page-shell";

/**
 * `/dev/kitchen-sink` (D-013): every Design System component rendered in isolation, on one page,
 * in the current theme and locale. Its job is to make a component's real behaviour observable --
 * by a reviewer, and by whoever is building the next one -- without standing up the feature screen
 * that will eventually consume it. D-003 through D-006 each had to build a throwaway demo page to
 * verify anything; this route is what replaces that.
 *
 * Deliberately **outside** both route groups and listed in `proxy.ts`'s `PUBLIC_PATHNAMES`: it
 * renders no user data and calls no user-scoped endpoint, so requiring a session would only make
 * it harder to look at. The one exception is the upload section, which does talk to core-api and
 * therefore only functions for a signed-in viewer -- the section says so itself rather than
 * failing mysteriously.
 *
 * Not a Server Component boundary violation to have the interactive parts here: the page is a
 * Server Component and `<KitchenSink>` is the single `"use client"` island (brief §6.4).
 */
export default async function KitchenSinkPage() {
  const t = await getTranslations("KitchenSink");

  return (
    <PageShell title={t("title")} subtitle={t("subtitle")} breadcrumbs={[{ label: t("title") }]}>
      <KitchenSink />
    </PageShell>
  );
}
