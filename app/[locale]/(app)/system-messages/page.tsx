import { forbidden } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/lib/api/current-user";
import { getAllSystemMessages } from "@/lib/api/system-messages";
import { resolveBreadcrumbsForNamespace } from "@/lib/breadcrumbs/manifest";

import { routing } from "@/i18n/routing";
import { MessageManager } from "@/components/messages/message-manager";
import { PageShell } from "@/components/page-shell";

/**
 * Broadcasts to everybody, and the screen that writes them (AD-007) -- the last placeholder page
 * the sidebar linked to.
 *
 * **Reading the whole list is narrower than writing a message**, which is the odd shape of this
 * feature: `permissions.neon` grants `notification.create` from the `supervisor` role up and
 * `update`/`remove` to a message's author, but `viewAll` -- the list this page is -- only to a
 * superadmin (verified live, 403 for a supervisor). So a supervisor may in principle write one and
 * has nowhere to see it afterwards. This app does not paper over that: the screen is the
 * superadmin's, and DEC-115 records the capability nobody can reach.
 *
 * The messages themselves reach readers through the app shell, not through here.
 */
export default async function SystemMessagesPage() {
  const [locale, viewer] = await Promise.all([getLocale(), getCurrentUser()]);
  if (viewer.role !== "superadmin") forbidden();

  const [t, messages, breadcrumbs] = await Promise.all([
    getTranslations("SystemMessages"),
    getAllSystemMessages(),
    resolveBreadcrumbsForNamespace("SystemMessages", locale),
  ]);

  return (
    <PageShell title={t("title")} subtitle={t("subtitle")} breadcrumbs={breadcrumbs}>
      <MessageManager messages={messages} locales={routing.locales} />
    </PageShell>
  );
}
