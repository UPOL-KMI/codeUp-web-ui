import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/lib/api/current-user";
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

/**
 * "My profile" (S-021) -- the same screen as anyone else's, rendered here rather than redirected
 * to, so a click costs one request instead of two and no caller ever catches the page
 * mid-navigation. The breadcrumb is this route's own ("Profile"), which is what a reader looking
 * at their own account expects to see.
 */
export default async function ProfilePage() {
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);

  // Unawaited, like `/users/:userId`'s (PF-005) -- this one is a message lookup rather than a
  // fetch, but the shape is the same, including the `catch` that keeps a rejection from counting
  // as unhandled while nothing is awaiting it yet.
  const breadcrumbs = resolveBreadcrumbs("/profile", locale);
  breadcrumbs.catch(() => {});

  return <ProfileView userId={user.id} breadcrumbs={breadcrumbs} />;
}
