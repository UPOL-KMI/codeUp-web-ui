import { getLocale, getTranslations } from "next-intl/server";

import {
  CATALOG_PAGE_SIZE,
  getExerciseCatalog,
  getExerciseTags,
  type ArchivedScope,
} from "@/lib/api/exercises";
import { getMyGroups } from "@/lib/api/groups";
import { getRuntimeEnvironments } from "@/lib/api/runtime-environments";
import { resolveBreadcrumbsForNamespace } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { CreateExercise } from "@/components/exercises/create-exercise";
import { ExerciseTable } from "@/components/exercises/exercise-table";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/state/empty-state";

/**
 * The exercise catalog (T-020) -- the legacy `/app/exercises` page, and the screen the sidebar has
 * been linking to since D-014.
 *
 * **Everything that narrows this list is a URL and a round trip.** The endpoint is genuinely
 * paginated, an instance can hold thousands of exercises, and core-api does the searching,
 * filtering, ordering and slicing itself -- so the form below is a plain `GET` form and the pager
 * is two links. No JavaScript is needed to use this screen, and a narrowed view is an address
 * somebody can send to a colleague.
 *
 * Who sees it at all is `canViewAll` on the exercise ACL, which core-api checks; `apiRead` turns
 * its refusal into the refusal page. Each row is then core-api's own answer again -- the list
 * contains only exercises this reader may view, and the name links only where `viewDetail` says so.
 *
 * Creating one is **not here**: `POST /exercises` makes an empty, broken exercise that is useless
 * until its texts and configuration exist, so it belongs with the screen that edits them (T-008),
 * the same way assigning belongs with T-002's settings (DEC-093).
 */
const ARCHIVED_SCOPES: ArchivedScope[] = ["default", "all", "only"];

export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    archived?: string;
    env?: string;
    tag?: string;
    page?: string;
  }>;
}) {
  const [query, locale] = await Promise.all([searchParams, getLocale()]);

  const search = (query.q ?? "").trim();
  const archived = ARCHIVED_SCOPES.find((scope) => scope === query.archived) ?? "default";
  const environments = query.env ? [query.env] : [];
  const tags = query.tag ? [query.tag] : [];
  const page = Math.max(0, Number(query.page ?? "0") || 0);

  const [t, catalog, allEnvironments, allTags, mine, breadcrumbs] = await Promise.all([
    getTranslations("Exercises"),
    getExerciseCatalog({ search, archived, environments, tags, page }, locale),
    getRuntimeEnvironments(),
    getExerciseTags(),
    // Where a new exercise could go: core-api's `createExercise` wants a group the reader
    // supervises or administers, which is exactly this list (T-008).
    getMyGroups(locale),
    resolveBreadcrumbsForNamespace("Exercises", locale),
  ]);

  // Whether anything is narrowing the list, which decides what "nothing here" means: an empty
  // catalog and a filter that matched nothing are different sentences.
  const narrowed =
    search !== "" || archived !== "default" || environments.length > 0 || tags.length > 0;
  const lastPage = Math.max(0, Math.ceil(catalog.totalCount / CATALOG_PAGE_SIZE) - 1);
  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (archived !== "default") params.set("archived", archived);
    if (environments[0]) params.set("env", environments[0]);
    if (tags[0]) params.set("tag", tags[0]);
    if (target > 0) params.set("page", String(target));
    const serialized = params.toString();
    return serialized ? `/exercises?${serialized}` : "/exercises";
  };

  return (
    <PageShell title={t("title")} subtitle={t("subtitle")} breadcrumbs={breadcrumbs}>
      <div className="flex flex-col gap-4">
        <CreateExercise groups={mine.teaching} />

        {/* A plain GET form: the filters are the server's business, and the URL they produce is
            the shareable view (brief §9). The page resets to the first whenever they change,
            which is why it is not carried in a hidden field. */}
        <form method="get" className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t("filters.search")}
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder={t("filters.searchPlaceholder")}
              className="min-w-56 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t("filters.environment")}
            <select
              name="env"
              defaultValue={environments[0] ?? ""}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">{t("filters.anyEnvironment")}</option>
              {allEnvironments.map((environment) => (
                <option key={environment.id} value={environment.id}>
                  {environment.name}
                </option>
              ))}
            </select>
          </label>

          {allTags.length > 0 && (
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("filters.tag")}
              <select
                name="tag"
                defaultValue={tags[0] ?? ""}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">{t("filters.anyTag")}</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t("filters.archived")}
            <select
              name="archived"
              defaultValue={archived}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              {ARCHIVED_SCOPES.map((scope) => (
                <option key={scope} value={scope}>
                  {t(`filters.archivedScopes.${scope}`)}
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
                from: page * CATALOG_PAGE_SIZE + 1,
                to: page * CATALOG_PAGE_SIZE + catalog.items.length,
                total: catalog.totalCount,
              })}
            </p>

            <ExerciseTable page={catalog} />

            {lastPage > 0 && (
              <nav aria-label={t("pagination.label")} className="flex items-center gap-3 text-sm">
                {page > 0 ? (
                  <Link
                    href={pageHref(page - 1)}
                    className="rounded-md border border-input px-2 py-1 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {t("pagination.previous")}
                  </Link>
                ) : (
                  <span className="rounded-md border border-input px-2 py-1 text-muted-foreground opacity-50">
                    {t("pagination.previous")}
                  </span>
                )}
                <span className="text-muted-foreground">
                  {t("pagination.page", { page: page + 1, total: lastPage + 1 })}
                </span>
                {page < lastPage ? (
                  <Link
                    href={pageHref(page + 1)}
                    className="rounded-md border border-input px-2 py-1 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {t("pagination.next")}
                  </Link>
                ) : (
                  <span className="rounded-md border border-input px-2 py-1 text-muted-foreground opacity-50">
                    {t("pagination.next")}
                  </span>
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
