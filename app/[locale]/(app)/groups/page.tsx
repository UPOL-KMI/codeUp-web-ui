import { getTranslations } from "next-intl/server";

import { PlaceholderPage } from "@/components/placeholder-page";

export default async function GroupsPage() {
  const t = await getTranslations("Groups");
  return <PlaceholderPage title={t("title")} />;
}
