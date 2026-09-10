import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { ProfileView } from "@/components/users/profile-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Profile" });
  return { title: t("title") };
}

/** Anyone's profile (S-021). The reader's own is the same screen at `/profile`. */
export default async function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const [{ userId }, locale] = await Promise.all([params, getLocale()]);
  // Not awaited: `ProfileView` awaits it alongside its own reads (PF-005).
  const breadcrumbs = resolveBreadcrumbs(`/users/${userId}`, locale);

  return <ProfileView userId={userId} breadcrumbs={breadcrumbs} />;
}
