import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/lib/api/current-user";
import { getGroupDetail } from "@/lib/api/group-detail";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { PageShell } from "@/components/page-shell";
import { ImportRosterForm } from "@/components/users/import-roster-form";
import { buttonClasses } from "@/components/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("UserImport");
  return { title: t("title") };
}

/**
 * Importing a list of people (AD-009).
 *
 * Offered on the reader's role, like every other administrative screen here, because a user object
 * carries no permission hints (DEC-110). `user.inviteForRegistration` is core-api's own gate and
 * reaches down to `supervisor-student`, but everything else this screen does -- searching the whole
 * directory, writing external identifiers -- is the superadmin's, so that is where the line is
 * drawn until someone needs it lower.
 *
 * `?group=` puts everyone invited straight into that group, which is the ordinary case: a cohort is
 * imported into the course it studies.
 */
export default async function ImportUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const [{ group }, locale, viewer] = await Promise.all([
    searchParams,
    getLocale(),
    getCurrentUser(),
  ]);

  if (viewer.role !== "superadmin") forbidden();

  const [t, breadcrumbs, groupDetail] = await Promise.all([
    getTranslations("UserImport"),
    resolveBreadcrumbs("/users/import", locale),
    group === undefined ? null : getGroupDetail(group, locale),
  ]);

  return (
    <PageShell
      title={t("title")}
      subtitle={t("subtitle")}
      breadcrumbs={breadcrumbs}
      actions={
        <Link href="/users" className={buttonClasses("outline", "sm")}>
          {t("backToUsers")}
        </Link>
      }
    >
      <ImportRosterForm groupId={group} groupName={groupDetail?.name} />
    </PageShell>
  );
}
