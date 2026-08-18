import { getTranslations } from "next-intl/server";

import { PlaceholderPage } from "@/components/placeholder-page";

export default async function ArchivePage() {
  const t = await getTranslations("Archive");
  return <PlaceholderPage title={t("title")} />;
}
