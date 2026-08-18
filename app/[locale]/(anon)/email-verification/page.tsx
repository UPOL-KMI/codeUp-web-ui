import { getTranslations } from "next-intl/server";

import { PlaceholderPage } from "@/components/placeholder-page";

export default async function EmailVerificationPage() {
  const t = await getTranslations("EmailVerification");
  return <PlaceholderPage title={t("title")} />;
}
