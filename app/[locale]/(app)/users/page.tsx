import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/lib/api/current-user";
import { USER_ROLES, type UserRole } from "@/lib/api/user-roles";
import {
  DIRECTORY_PAGE_SIZE,
  USER_ORDERINGS,
  getUserDirectory,
  type UserOrdering,
} from "@/lib/api/users";
import { resolveBreadcrumbsForNamespace } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/state/empty-state";
import { CreateUser } from "@/components/users/create-user";
import { UserTable } from "@/components/users/user-table";
import { buttonClasses } from "@/components/button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Users" });
  return { title: t("title") };
}

/**
 * The user directory (AD-001) -- the legacy `/app/users` page, and the screen the sidebar has been
 * linking to since D-014, where it found a `PlaceholderPage`.
 *
 * **Everything that narrows or reorders this list is a URL and a round trip**, the same trade the
 * exercise catalog makes (DEC-097): core-api pages, searches, filters and sorts the whole result
 * itself, so the form is a plain `GET`, the sort controls are links, the pager is two links, and
 * a narrowed view is an address somebody can send to a colleague. None of it needs JavaScript.
 *
 * Who may see it at all is core-api's `user.viewAll`, which it checks -- granted from `supervisor`
 * upwards and **not** to a `supervisor-student`, who inherits only `viewList`. `apiRead` turns
 * that refusal into the refusal page, so the rule lives in one place and it is not this one.
 *
 * The account actions are a different question and a harder one: a user object carries no
 * `permissionHints` (DEC-080), so there is nothing to ask, and what is *offered* is decided from
 * the reader's own role -- the legacy app's rule, and the only one available (DEC-110). What
 * actually happens is still core-api's call, on the caller's own token.
 */
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    role?: string | string[];
    sort?: string;
    dir?: string;
    page?: string;
  }>;
}) {
  const [query, locale] = await Promise.all([searchParams, getLocale()]);

  const search = (query.q ?? "").trim();
  const requestedRoles = Array.isArray(query.role) ? query.role : query.role ? [query.role] : [];
  const roles = USER_ROLES.filter((role) => requestedRoles.includes(role));
  const orderBy: UserOrdering = USER_ORDERINGS.find((column) => column === query.sort) ?? "name";
  const descending = query.dir === "desc";
  const page = Math.max(0, Number(query.page ?? "0") || 0);

  const [t, directory, viewer, breadcrumbs] = await Promise.all([
    getTranslations("Users"),
    getUserDirectory({ search, roles, orderBy, descending, page }),
    getCurrentUser(),
    resolveBreadcrumbsForNamespace("Users", locale),
  ]);

  const hrefFor = (overrides: {
    sort?: UserOrdering;
    dir?: "asc" | "desc";
    page?: number;
  }): string => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    for (const role of roles) params.append("role", role);
    const sort = overrides.sort ?? orderBy;
    const direction = overrides.dir ?? (descending ? "desc" : "asc");
    if (sort !== "name") params.set("sort", sort);
    if (direction !== "asc") params.set("dir", direction);
    const target = overrides.page ?? page;
    if (target > 0) params.set("page", String(target));
    const serialized = params.toString();
    return serialized ? `/users?${serialized}` : "/users";
  };

  // Clicking the column already sorted on reverses it; clicking another starts it ascending, and
  // either way the reader goes back to the first page -- the row they were looking at is not on
  // page three of a different ordering.
  const sortHrefs = Object.fromEntries(
    USER_ORDERINGS.map((column) => [
      column,
      hrefFor({
        sort: column,
        dir: orderBy === column && !descending ? "desc" : "asc",
        page: 0,
      }),
    ]),
  ) as Record<UserOrdering, string>;

  const narrowed = search !== "" || roles.length > 0;
  const lastPage = Math.max(0, Math.ceil(directory.totalCount / DIRECTORY_PAGE_SIZE) - 1);
  const manageable = viewer.role === "superadmin";

  return (
    <PageShell title={t("title")} subtitle={t("subtitle")} breadcrumbs={breadcrumbs}>
      <div className="flex flex-col gap-4">
        {manageable && (
          <div className="flex flex-wrap items-center gap-2">
            <CreateUser />
            {/* Warning-coloured, and next to the dialog rather than in the header, because the two
                are the same decision at two scales -- and this is the one that sends mail to a
                list of people the moment it is confirmed. */}
            <Link href="/users/import" className={buttonClasses("warning-outline", "sm")}>
              {t("import")}
            </Link>
          </div>
        )}

        {/* A plain GET form: the filters are the server's business, and the URL they produce is
            the shareable view (brief §9). Sort and page are deliberately not carried in hidden
            fields -- a new filter is a new result, and page three of it means nothing. */}
        <form method="get" className="flex flex-col gap-3 rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("filters.search")}
              <input
                type="search"
                name="q"
                defaultValue={search}
                placeholder={t("filters.searchPlaceholder")}
                className="min-w-64 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <button type="submit" className={buttonClasses("outline", "sm")}>
              {t("filters.apply")}
            </button>
          </div>

          <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <legend className="text-xs text-muted-foreground">{t("filters.roles")}</legend>
            {USER_ROLES.map((role) => (
              <label key={role} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  name="role"
                  value={role}
                  defaultChecked={roles.includes(role as UserRole)}
                  className="size-4 rounded border-input accent-primary"
                />
                {t(`rolesPlural.${role}`)}
              </label>
            ))}
          </fieldset>
        </form>

        {directory.items.length === 0 ? (
          <EmptyState
            title={t("empty.title")}
            description={narrowed ? t("empty.noMatch") : t("empty.description")}
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t("summary", {
                from: page * DIRECTORY_PAGE_SIZE + 1,
                to: page * DIRECTORY_PAGE_SIZE + directory.items.length,
                total: directory.totalCount,
              })}
            </p>

            <UserTable
              page={directory}
              sortHrefs={sortHrefs}
              orderBy={orderBy}
              descending={descending}
              viewerId={viewer.id}
              manageable={manageable}
            />

            {lastPage > 0 && (
              <nav aria-label={t("pagination.label")} className="flex items-center gap-3 text-sm">
                {page > 0 ? (
                  <Link
                    href={hrefFor({ page: page - 1 })}
                    className={buttonClasses("outline", "sm")}
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
                    href={hrefFor({ page: page + 1 })}
                    className={buttonClasses("outline", "sm")}
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
