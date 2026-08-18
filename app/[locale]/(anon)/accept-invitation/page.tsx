import { getTranslations } from "next-intl/server";

import { PlaceholderPage } from "@/components/placeholder-page";

export default async function AcceptInvitationPage() {
  const t = await getTranslations("AcceptInvitation");
  return <PlaceholderPage title={t("title")} />;
}
