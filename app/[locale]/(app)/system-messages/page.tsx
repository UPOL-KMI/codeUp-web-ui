import { getTranslations } from "next-intl/server";

import { PlaceholderPage } from "@/components/placeholder-page";

export default async function SystemMessagesPage() {
  const t = await getTranslations("SystemMessages");
  return <PlaceholderPage title={t("title")} />;
}
