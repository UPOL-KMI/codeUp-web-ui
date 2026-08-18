import { getTranslations } from "next-intl/server";

import { PlaceholderPage } from "@/components/placeholder-page";

export default async function DashboardPage() {
  const t = await getTranslations("Dashboard");
  return <PlaceholderPage title={t("title")} />;
}
