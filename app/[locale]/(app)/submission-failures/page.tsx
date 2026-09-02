import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getSubmissionFailures, type FailureScope } from "@/lib/api/submission-failures";
import { resolveBreadcrumbsForNamespace } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { FailureTable } from "@/components/failures/failure-table";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/state/empty-state";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "SubmissionFailures" });
  return { title: t("title") };
}

/**
 * Submissions that never became results (T-019) -- the legacy `/app/submission-failures` page.
 *
 * **It opens on what is unresolved, not on everything (DEC-096).** core-api serves both, the
 * history is unbounded and unpaginated, and this screen is a queue: a failure that somebody has
 * already dealt with is a record, not a task. "Everything" is one click away and keeps the parity.
 *
 * Who may read it is core-api's answer -- `canViewAll` on the failure ACL, which on this
 * deployment is nobody but an administrator (a supervisor's request answers 403, verified live).
 * There is no role check here: `apiRead` turns that refusal into the refusal page (F-030).
 */
const SCOPES: FailureScope[] = ["unresolved", "all"];

export default async function SubmissionFailuresPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const [query, locale] = await Promise.all([searchParams, getLocale()]);
  const scope = SCOPES.find((candidate) => candidate === query.scope) ?? "unresolved";

  const [t, failures, breadcrumbs] = await Promise.all([
    getTranslations("SubmissionFailures"),
    getSubmissionFailures(scope),
    resolveBreadcrumbsForNamespace("SubmissionFailures", locale),
  ]);

  return (
    <PageShell title={t("title")} subtitle={t("subtitle")} breadcrumbs={breadcrumbs}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {SCOPES.map((option) => {
            const active = option === scope;
            return (
              <Link
                key={option}
                href={
                  option === "unresolved"
                    ? "/submission-failures"
                    : "/submission-failures?scope=all"
                }
                aria-current={active ? "true" : undefined}
                className={`rounded-full px-3 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(`scopes.${option}`)}
              </Link>
            );
          })}
        </div>

        {failures.length === 0 ? (
          <EmptyState
            title={t(`empty.${scope}.title`)}
            description={t(`empty.${scope}.description`)}
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t("summary", { count: failures.length })}
            </p>
            <FailureTable failures={failures} />
          </>
        )}
      </div>
    </PageShell>
  );
}
