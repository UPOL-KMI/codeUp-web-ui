import "server-only";

import { isUserRole, type UserRole } from "./user-roles";
import { apiRead } from "./read";

/**
 * The user directory (AD-001): everybody the instance knows, for somebody looking for one of them.
 *
 * Paginated the same way the exercise catalog is (T-020/DEC-097), and for the same reason -- the
 * endpoint is genuinely paginated, an instance holds every account that ever registered, and
 * core-api does the searching, filtering and ordering itself. So the query is the URL.
 *
 * **The filters go under `filters[...]` and the ordering is a whitelist that fails silently on
 * both counts.** An unknown filter key is ignored (the bug T-020 found in T-001's picker) and so
 * is an unknown `orderBy` -- `orderBy=bogus` answers HTTP 200 with the rows in whatever order the
 * database liked, not an error. Both verified live. Hence `USER_ORDERINGS` below: it is
 * `Users::getPaginated`'s own `PaginationDbHelper` table, restated, and nothing outside it is ever
 * sent.
 *
 * `search` matches first name, last name **and email** (`['firstName', 'lastName', 'email']` in
 * that same helper), which is why the one box is labelled for both.
 *
 * Who may read any of this is core-api's `user.viewAll`, granted from the `supervisor` role
 * upwards -- **not** from `supervisor-student`, who inherits only `viewList` and is refused
 * (verified live, both directions). `apiRead` turns that refusal into the refusal page, so this
 * app carries no copy of the rule.
 */
/** core-api's three sortable columns; `name` collates by surname then first name. */
export const USER_ORDERINGS = ["name", "email", "createdAt"] as const;

export type UserOrdering = (typeof USER_ORDERINGS)[number];

export const DIRECTORY_PAGE_SIZE = 20;

export interface UserDirectoryQuery {
  search: string;
  roles: UserRole[];
  orderBy: UserOrdering;
  descending: boolean;
  /** Zero-based. */
  page: number;
}

export interface DirectoryUser {
  id: string;
  fullName: string;
  /** Present only where core-api discloses the person's private block. */
  email: string | null;
  role: UserRole | null;
  createdAt: number | null;
  /** False for an account an administrator has disabled. */
  isAllowed: boolean | null;
}

export interface UserDirectoryPage {
  items: DirectoryUser[];
  /** How many the query matched, which need not be how many are listed. */
  totalCount: number;
  page: number;
}

interface UserPayload {
  id: string;
  fullName: string;
  privateData?: {
    email?: string;
    role?: string;
    createdAt?: number;
    isAllowed?: boolean;
  } | null;
}

interface UserEnvelope {
  items: UserPayload[];
  totalCount: number;
}

export async function getUserDirectory(query: UserDirectoryQuery): Promise<UserDirectoryPage> {
  const envelope = await apiRead<UserEnvelope>("/v1/users", {
    query: {
      limit: DIRECTORY_PAGE_SIZE,
      offset: query.page * DIRECTORY_PAGE_SIZE,
      orderBy: `${query.descending ? "!" : ""}${query.orderBy}`,
      ...(query.search !== "" && { "filters[search]": query.search }),
      ...(query.roles.length > 0 && { "filters[roles]": query.roles }),
    },
  });

  return {
    items: envelope.items.map((user) => ({
      id: user.id,
      fullName: user.fullName,
      email: user.privateData?.email ?? null,
      role: isUserRole(user.privateData?.role) ? user.privateData.role : null,
      createdAt: user.privateData?.createdAt ?? null,
      isAllowed: user.privateData?.isAllowed ?? null,
    })),
    totalCount: envelope.totalCount,
    page: query.page,
  };
}
