import { getLocale, getTranslations } from "next-intl/server";

import { getPipelineCatalog, PIPELINE_PAGE_SIZE } from "@/lib/api/pipelines";
import { getRuntimeEnvironments } from "@/lib/api/runtime-environments";
import { resolveBreadcrumbsForNamespace } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { DateTime } from "@/components/format/date-time";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/status/badge";
import { EmptyState } from "@/components/state/empty-state";

/**
 * The instance's pipelines (T-013) -- the legacy `/app/pipelines` page, and the screen the sidebar
 * has been linking at a placeholder since D-014.
 *
 * A pipeline is the machinery an exercise's tests actually run on. Most people never come here:
 * an exercise author picks from what the instance offers, which is what T-009's configuration
 * editor does on their behalf. This is for whoever maintains those offerings, and the question it
 * answers is "which pipeline does what" -- so the row leads with the **parameters**, the flags
 * that decide where a variable belongs and which of them T-009 reads to build its form.
 *
 * **Searching and paging are core-api's**, the same trade T-020 records for the exercise catalog:
 * the filters are a plain `GET` form, the pager is two links, and a narrowed view is an address.
 * The one exception is the language filter, which core-api's pipeline endpoint does not offer
 * (`search`, `exerciseId` and `authorId` are its whole vocabulary, read from the presenter) -- so
 * that one narrows the page in hand, and the screen says so rather than implying otherwise.
 */
export default async function PipelinesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; env?: string; page?: string }>;
}) {
  const [query, locale] = await Promise.all([searchParams, getLocale()]);

  const search = (query.q ?? "").trim();
  const environment = query.env ?? "";
  const page = Math.max(0, Number(query.page ?? "0") || 0);

  const [t, catalog, environments, breadcrumbs] = await Promise.all([
    getTranslations("Pipelines"),
    getPipelineCatalog({ search, environment, offset: page * PIPELINE_PAGE_SIZE }),
    getRuntimeEnvironments(),
    resolveBreadcrumbsForNamespace("Pipelines", locale),
  ]);

  const narrowed = search !== "" || environment !== "";
  const lastPage = Math.max(0, Math.ceil(catalog.total / PIPELINE_PAGE_SIZE) - 1);
  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (environment) params.set("env", environment);
    if (target > 0) params.set("page", String(target));
    const serialized = params.toString();
    return serialized ? `/pipelines?${serialized}` : "/pipelines";
  };

  const control =
    "rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";

  return (
    <PageShell title={t("title")} subtitle={t("subtitle")} breadcrumbs={breadcrumbs}>
      <div className="flex flex-col gap-4">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t("filters.search")}
            <input type="search" name="q" defaultValue={search} className={`${control} min-w-56`} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t("filters.environment")}
            <select name="env" defaultValue={environment} className={control}>
              <option value="">{t("filters.anyEnvironment")}</option>
              {environments.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("filters.apply")}
          </button>
          {environment && (
            <p className="basis-full text-xs text-muted-foreground">{t("filters.envIsLocal")}</p>
          )}
        </form>

        {catalog.items.length === 0 ? (
          <EmptyState
            title={t("empty.title")}
            description={narrowed ? t("empty.noMatch") : t("empty.description")}
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t("summary", {
                from: page * PIPELINE_PAGE_SIZE + 1,
                to: page * PIPELINE_PAGE_SIZE + catalog.items.length,
                total: catalog.total,
              })}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th scope="col" className="py-1 pr-3 font-medium">
                      {t("columns.name")}
                    </th>
                    <th scope="col" className="py-1 pr-3 font-medium">
                      {t("columns.environments")}
                    </th>
                    <th scope="col" className="py-1 pr-3 font-medium">
                      {t("columns.parameters")}
                    </th>
                    <th scope="col" className="py-1 pr-3 font-medium">
                      {t("columns.author")}
                    </th>
                    <th scope="col" className="py-1 font-medium">
                      {t("columns.updated")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.items.map((pipeline) => (
                    <tr key={pipeline.id} className="border-b border-border/50 align-top">
                      <td className="py-2 pr-3">
                        <Link
                          href={`/pipelines/${pipeline.id}`}
                          className="text-primary underline underline-offset-2"
                        >
                          {pipeline.name}
                        </Link>
                        {pipeline.description && (
                          <span className="block max-w-prose text-xs text-muted-foreground">
                            {pipeline.description.split("\n")[0]}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {pipeline.environmentNames.join(", ") || (
                          <span className="text-muted-foreground">{t("noEnvironments")}</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <span className="flex flex-wrap gap-1">
                          {pipeline.parameters.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              {t("noParameters")}
                            </span>
                          ) : (
                            pipeline.parameters.map((parameter) => (
                              <Badge key={parameter} tone="neutral">
                                {/* A parameter core-api grows tomorrow keeps its own name rather
                                    than throwing: the vocabulary is the instance's, not this
                                    app's, and a missing sentence is not a broken page. */}
                                {t.has(`parameters.${parameter}`)
                                  ? t(`parameters.${parameter}`)
                                  : parameter}
                              </Badge>
                            ))
                          )}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        {pipeline.authorName ?? (
                          <span className="text-muted-foreground">{t("instanceOwned")}</span>
                        )}
                      </td>
                      <td className="py-2">
                        <DateTime unixSeconds={pipeline.updatedAt} dateOnly />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {lastPage > 0 && (
              <nav aria-label={t("pagination")} className="flex gap-2">
                {page > 0 && (
                  <Link
                    href={pageHref(page - 1)}
                    className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    {t("previous")}
                  </Link>
                )}
                {page < lastPage && (
                  <Link
                    href={pageHref(page + 1)}
                    className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    {t("next")}
                  </Link>
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
