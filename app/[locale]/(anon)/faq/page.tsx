import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PlaceholderPage } from "@/components/placeholder-page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Faq" });
  return { title: t("title") };
}

export default function FaqPage() {
  return <PlaceholderPage namespace="Faq" />;
}
