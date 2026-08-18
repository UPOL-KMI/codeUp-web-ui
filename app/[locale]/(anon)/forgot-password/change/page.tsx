import { getTranslations } from "next-intl/server";

import { PlaceholderPage } from "@/components/placeholder-page";

export default async function ForgotPasswordChangePage() {
  const t = await getTranslations("ForgotPasswordChange");
  return <PlaceholderPage title={t("title")} />;
}
