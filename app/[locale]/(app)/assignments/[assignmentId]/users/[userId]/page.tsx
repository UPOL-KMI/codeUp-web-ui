import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getAssignmentDetail, getAssignmentSolutionsOf } from "@/lib/api/assignment";
import { apiRead } from "@/lib/api/read";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { SolutionList } from "@/components/assignments/solution-list";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/state/empty-state";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Assignment" });
  return { title: t("title") };
}

/**
 * One student's attempts at one assignment (S-013) -- the legacy
 * `/app/assignment/:assignmentId/user/:userId` route, which is how a teacher gets from a name in
 * the class table to what that person actually submitted.
 *
 * The permission checked here is `viewAssignmentSolutions` on the assignment, the same hint that
 * decides whether the class table is rendered at all; core-api re-checks it on the request for the
 * solutions regardless. Calling `forbidden()` rather than letting that 403 surface as a generic
 * error is the difference between "you may not read this" and "something went wrong".
 */
export default async function AssignmentUserSolutionsPage({
  params,
}: {
  params: Promise<{ assignmentId: string; userId: string }>;
}) {
  const [{ assignmentId, userId }, locale] = await Promise.all([params, getLocale()]);
  const [t, assignment] = await Promise.all([
    getTranslations("Assignment"),
    getAssignmentDetail(assignmentId, locale),
  ]);

  if (!assignment.can.viewAssignmentSolutions) forbidden();

  const [solutions, user, breadcrumbs] = await Promise.all([
    getAssignmentSolutionsOf(assignmentId, userId),
    apiRead<{ fullName?: string }>("/v1/users/{id}", { pathParams: { id: userId } }),
    resolveBreadcrumbs(`/assignments/${assignmentId}/users/${userId}`, locale),
  ]);

  return (
    <PageShell
      title={t("userSolutions.title", { name: user.fullName ?? "" })}
      subtitle={assignment.name}
      breadcrumbs={breadcrumbs}
      actions={
        <Link
          href={`/assignments/${assignmentId}`}
          className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {t("userSolutions.backToAssignment")}
        </Link>
      }
    >
      {solutions.length === 0 ? (
        <EmptyState
          title={t("userSolutions.empty.title")}
          description={t("userSolutions.empty.description", { name: user.fullName ?? "" })}
        />
      ) : (
        <SolutionList solutions={solutions} />
      )}
    </PageShell>
  );
}
