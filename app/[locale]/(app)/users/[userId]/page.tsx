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

  // Started here and awaited inside `ProfileView`'s own `Promise.all` (PF-005): the chain ends in
  // this person's name, which is a fetch, and awaiting it here would put that one request in front
  // of every other read the screen makes.
  //
  // **The empty `catch` is load-bearing.** Between this line and React calling `ProfileView`,
  // nothing is awaiting this promise -- so a chain that rejects in that window (an id nobody has,
  // whose crumb resolver calls `notFound()`) counts as an unhandled rejection, and what the reader
  // gets is the error boundary instead of the Not found page. Attaching a handler marks it as
  // handled without consuming it: the rejection still reaches whoever awaits the original.
  const breadcrumbs = resolveBreadcrumbs(`/users/${userId}`, locale);
  breadcrumbs.catch(() => {});

  return <ProfileView userId={userId} breadcrumbs={breadcrumbs} />;
}
