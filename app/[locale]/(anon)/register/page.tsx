import { getTranslations } from "next-intl/server";

import { PlaceholderPage } from "@/components/placeholder-page";

export default async function RegisterPage() {
  const t = await getTranslations("Register");
  return <PlaceholderPage title={t("title")} />;
}
