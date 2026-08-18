import { getTranslations } from "next-intl/server";

import { PlaceholderPage } from "@/components/placeholder-page";

export default async function LoginPage() {
  const t = await getTranslations("Login");
  return <PlaceholderPage title={t("title")} />;
}
