import { getTranslations } from "next-intl/server";

import { PlaceholderPage } from "@/components/placeholder-page";

export default async function FaqPage() {
  const t = await getTranslations("Faq");
  return <PlaceholderPage title={t("title")} />;
}
