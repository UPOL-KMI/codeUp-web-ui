import { getTranslations } from "next-intl/server";

import type { UserDirectoryPage, UserOrdering } from "@/lib/api/users";

import { Link } from "@/i18n/navigation";
import { DateTime } from "@/components/format/date-time";
import { Badge } from "@/components/status/badge";

import { UserRowActions } from "./user-row-actions";

/**
 * The directory itself (AD-001): one row per account.
 *
 * Not a `DataTable`, for the reason the exercise catalog is not one: this list is **not fetched
 * whole**. The ordering is core-api's, so each sortable heading is a link that goes back to the
 * server with a different `orderBy` -- a control that reordered the twenty rows on screen would be
 * lying about the other eleven.
 *
 * **The email is the second thing anybody looks up here**, which is why it is a column rather than
 * a line under the name: an administrator arrives on this screen holding either a name or an
 * address, and core-api's search matches both.
 *
 * **The only badge is "disabled"**, because it is the only thing that changes what a row means:
 * core-api refuses that account everything until somebody sets the flag back. Whether the address
 * was ever confirmed is on the person's own profile (S-021) and not here -- it is true of most
 * accounts on an instance that never had working mail, so a badge for it costs every row a second
 * line and tells the reader nothing.
 */
export async function UserTable({
  page,
  sortHrefs,
  orderBy,
  descending,
  viewerId,
  manageable,
}: {
  page: UserDirectoryPage;
  /** Where each sortable heading points; built by the page, alongside the pager's own links. */
  sortHrefs: Record<UserOrdering, string>;
  orderBy: UserOrdering;
  descending: boolean;
  viewerId: string;
  /** Whether to offer the account actions at all -- core-api decides whether they succeed. */
  manageable: boolean;
}) {
  const t = await getTranslations("Users");

  const heading = (column: UserOrdering, label: string) => {
    const active = orderBy === column;
    return (
      <th
        scope="col"
        className="px-3 py-2 text-left font-medium"
        aria-sort={active ? (descending ? "descending" : "ascending") : "none"}
      >
        <Link
          href={sortHrefs[column]}
          className="inline-flex items-center gap-1 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {label}
          <span aria-hidden="true" className={active ? "" : "opacity-0"}>
            {descending ? "↓" : "↑"}
          </span>
        </Link>
      </th>
    );
  };

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {heading("name", t("columns.name"))}
            {heading("email", t("columns.email"))}
            <th scope="col" className="px-3 py-2 text-left font-medium">
              {t("columns.role")}
            </th>
            {heading("createdAt", t("columns.createdAt"))}
            {manageable && (
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {t("columns.actions")}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {page.items.map((user) => (
            <tr key={user.id} className="border-b border-border last:border-0 hover:bg-muted/30">
              <td className="px-3 py-2">
                <span className="flex flex-col gap-1">
                  <Link
                    href={`/users/${user.id}`}
                    className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {user.fullName || t("unnamed")}
                  </Link>
                  <span className="flex flex-wrap gap-1">
                    {user.id === viewerId && <Badge tone="info">{t("flags.you")}</Badge>}
                    {user.isAllowed === false && <Badge tone="danger">{t("flags.disabled")}</Badge>}
                  </span>
                </span>
              </td>
              <td className="px-3 py-2">
                {user.email ? (
                  <a
                    href={`mailto:${encodeURIComponent(user.email)}`}
                    className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {user.email}
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                {user.role ? (
                  t(`roles.${user.role}`)
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {user.createdAt === null ? "—" : <DateTime unixSeconds={user.createdAt} dateOnly />}
              </td>
              {manageable && (
                <td className="px-3 py-2 text-right">
                  <UserRowActions
                    userId={user.id}
                    fullName={user.fullName || t("unnamed")}
                    isAllowed={user.isAllowed !== false}
                    isSelf={user.id === viewerId}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
