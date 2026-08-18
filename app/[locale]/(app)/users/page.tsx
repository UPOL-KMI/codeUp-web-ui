import { getTranslations } from "next-intl/server";

import { PlaceholderPage } from "@/components/placeholder-page";

export default async function UsersPage() {
  const t = await getTranslations("Users");
  return <PlaceholderPage title={t("title")} />;
}
