import { getLocale } from "next-intl/server";

import { getCurrentUser } from "@/lib/api/current-user";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { ProfileView } from "@/components/users/profile-view";

/**
 * "My profile" (S-021) -- the same screen as anyone else's, rendered here rather than redirected
 * to, so a click costs one request instead of two and no caller ever catches the page
 * mid-navigation. The breadcrumb is this route's own ("Profile"), which is what a reader looking
 * at their own account expects to see.
 */
export default async function ProfilePage() {
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  const breadcrumbs = await resolveBreadcrumbs("/profile", locale);

  return <ProfileView userId={user.id} breadcrumbs={breadcrumbs} />;
}
