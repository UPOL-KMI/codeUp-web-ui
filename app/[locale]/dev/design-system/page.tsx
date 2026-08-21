import { getTranslations } from "next-intl/server";

import { DesignSystemShowcase } from "@/components/dev/design-system";
import { PageShell } from "@/components/page-shell";

/**
 * `/dev/design-system` (D-013): every Design System component rendered in isolation, on one page,
 * in the current theme and locale.
 *
 * The backlog calls this ticket `/dev/kitchen-sink`, the term Storybook/MUI/Bootstrap all use for
 * this kind of page. Renamed at the operator's request after they read the route and could not
 * tell what it was -- which is the only test of a name that matters. `/dev/` still marks it as
 * tooling rather than product; `design-system` says what it holds. Its job is to make a component's real behaviour observable --
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
export default async function DesignSystemPage() {
  const t = await getTranslations("DesignSystem");

  return (
    <PageShell title={t("title")} subtitle={t("subtitle")} breadcrumbs={[{ label: t("title") }]}>
      <DesignSystemShowcase />
    </PageShell>
  );
}
