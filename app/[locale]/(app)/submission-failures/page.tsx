import { getTranslations } from "next-intl/server";

import { PlaceholderPage } from "@/components/placeholder-page";

export default async function SubmissionFailuresPage() {
  const t = await getTranslations("SubmissionFailures");
  return <PlaceholderPage title={t("title")} />;
}
