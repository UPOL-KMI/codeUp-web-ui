import { getLocale, getTranslations } from "next-intl/server";

import { getAssignmentDetail } from "@/lib/api/assignment";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { AssignmentDetailView } from "@/components/assignments/assignment-detail";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/status/badge";

/**
 * An assignment (S-012) -- the destination every deadline row on the dashboard and in a group has
 * been linking to since S-001.
 *
 * The student view only. The teacher additions IA §4.3 lists (stats, "all submissions", "edit")
 * are S-013's, and each of them leads to a screen that does not exist yet; adding the buttons now
 * would mean three links to nothing.
 */
export default async function AssignmentPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const [{ assignmentId }, locale] = await Promise.all([params, getLocale()]);
  const [t, assignment] = await Promise.all([
    getTranslations("Assignment"),
    getAssignmentDetail(assignmentId, locale),
  ]);
  const breadcrumbs = await resolveBreadcrumbs(`/assignments/${assignmentId}`, locale);

  return (
    <PageShell
      title={assignment.name}
      breadcrumbs={breadcrumbs}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {assignment.isBonus && <Badge tone="info">{t("badges.bonus")}</Badge>}
          {assignment.isExam && <Badge tone="warning">{t("badges.exam")}</Badge>}
          {!assignment.isPublic && <Badge>{t("badges.hidden")}</Badge>}
          {assignment.groupId && (
            <Link
              href={`/groups/${assignment.groupId}?tab=assignments`}
              className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {t("backToGroup")}
            </Link>
          )}
        </div>
      }
      subtitle={assignment.groupName || undefined}
    >
      <AssignmentDetailView assignment={assignment} />
    </PageShell>
  );
}
