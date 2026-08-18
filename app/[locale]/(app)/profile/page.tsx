import { getTranslations } from "next-intl/server";

import { PlaceholderPage } from "@/components/placeholder-page";

export default async function ProfilePage() {
  const t = await getTranslations("Profile");
  return <PlaceholderPage title={t("title")} />;
}
