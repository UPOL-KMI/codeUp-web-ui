import { getTranslations } from "next-intl/server";

import { PlaceholderPage } from "@/components/placeholder-page";

export default async function ForgotPasswordPage() {
  const t = await getTranslations("ForgotPassword");
  return <PlaceholderPage title={t("title")} />;
}
