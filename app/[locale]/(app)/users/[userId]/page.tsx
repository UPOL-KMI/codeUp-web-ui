import { getLocale } from "next-intl/server";

import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { ProfileView } from "@/components/users/profile-view";

/** Anyone's profile (S-021). The reader's own is the same screen at `/profile`. */
export default async function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const [{ userId }, locale] = await Promise.all([params, getLocale()]);
  const breadcrumbs = await resolveBreadcrumbs(`/users/${userId}`, locale);

  return <ProfileView userId={userId} breadcrumbs={breadcrumbs} />;
}
