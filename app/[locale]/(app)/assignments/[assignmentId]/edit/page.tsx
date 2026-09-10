import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getAssignmentSettings } from "@/lib/api/assignment-edit";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { AssignmentForm } from "@/components/assignments/assignment-form";
import { AssignmentTextsForm } from "@/components/assignments/assignment-texts-form";
import { DeleteAssignment } from "@/components/assignments/delete-assignment";
import { PageShell } from "@/components/page-shell";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AssignmentEdit" });
  return { title: t("title") };
}

/**
 * An assignment's settings (T-002): when it is due, what it is worth, how often it may be
 * attempted, and how much of the evaluation a student is shown.
 *
 * **Not the exercise.** What is asked here is everything the *assignment* owns; the tests and the
 * limits belong to the exercise it was copied from, and changing those is T-008/T-010's screen
 * followed by the re-sync this ticket added to S-013's notice. The **text** is the one thing that
 * can be either: the assignment holds a copy, and G-007's second form overrides it for this class
 * alone, at the cost of a re-sync putting the exercise's back.
 *
 * **The refusal has to be an explicit check here, not `apiRead`'s.** Reading an assignment is
 * something a student may do -- it is their own assignment -- so the fetch this page makes
 * succeeds for them and only the *save* would be refused. Found by the spec: without this, a
 * student who guessed the URL was handed a filled-in settings form that core-api would reject on
 * submit. `update` is the hint the link is offered on, so the page asks the same question.
 */
export default async function EditAssignmentPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const [{ assignmentId }, locale] = await Promise.all([params, getLocale()]);
  const [t, assignment] = await Promise.all([
    getTranslations("AssignmentEdit"),
    getAssignmentSettings(assignmentId, locale, routing.locales),
  ]);
  if (assignment.can.update !== true) forbidden();

  const breadcrumbs = await resolveBreadcrumbs(`/assignments/${assignmentId}/edit`, locale);

  return (
    <PageShell
      title={t("title")}
      subtitle={assignment.name}
      breadcrumbs={breadcrumbs}
      actions={
        <Link
          href={`/assignments/${assignmentId}`}
          className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {t("backToAssignment")}
        </Link>
      }
    >
      <div className="flex max-w-3xl flex-col gap-10">
        <AssignmentForm assignment={assignment} />
        <AssignmentTextsForm assignment={assignment} />
        {assignment.can.remove === true && (
          <DeleteAssignment assignmentId={assignment.id} groupId={assignment.groupId} />
        )}
      </div>
    </PageShell>
  );
}
