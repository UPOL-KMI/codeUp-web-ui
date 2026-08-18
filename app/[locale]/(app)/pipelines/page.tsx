import { getTranslations } from "next-intl/server";

import { PlaceholderPage } from "@/components/placeholder-page";

export default async function PipelinesPage() {
  const t = await getTranslations("Pipelines");
  return <PlaceholderPage title={t("title")} />;
}
