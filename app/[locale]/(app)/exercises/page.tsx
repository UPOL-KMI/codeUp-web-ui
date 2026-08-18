import { getTranslations } from "next-intl/server";

import { PlaceholderPage } from "@/components/placeholder-page";

export default async function ExercisesPage() {
  const t = await getTranslations("Exercises");
  return <PlaceholderPage title={t("title")} />;
}
