"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { usePathname, useRouter } from "@/i18n/navigation";

type SortDirection = "asc" | "desc";

/**
 * What the table is doing to the rows, for the few cells whose rendering depends on it.
 *
 * The group list is the case that asked for it: it indents each row by its depth in the group
 * tree, which is only true while the rows are in the order the server sent them (or sorted by the
 * very column that carries the hierarchy). Sorted by anything else, an indent would draw a tree
 * that is not there.
 */
export interface DataTableOrder {
  /** The column the reader sorted by, or null for the order the rows arrived in. */
  sortColumn: string | null;
  sortDirection: SortDirection;
}

export interface DataTableColumn<T> {
  id: string;
  header: React.ReactNode;
  cell: (row: T, order: DataTableOrder) => React.ReactNode;
  /** Enables the sort control on this column's header. */
  sortable?: boolean;
  /** Value to sort by, if different from what `cell` renders (e.g. a raw timestamp vs. a
   *  formatted date string). Falls back to `String(cell(row))` if omitted. */
  sortValue?: (row: T) => string | number;
  /** Value matched against the filter query, if different from what `cell` renders. Falls back
   *  to `String(cell(row))` if omitted. */
  filterValue?: (row: T) => string;
  className?: string;
  /**
   * Which edge the column reads from. **Not a class**, deliberately: a right-aligned numeric
   * column has to align its *heading* too, and a sortable heading is a flex button, where
   * `text-align` does nothing at all. Passing it as data lets the header place the button and the
   * cell place its text from the same decision.
   */
  align?: "left" | "right";
}

export interface DataTableProps<T> {
  /** Prefixes this table's own `searchParams` keys (`${id}-sort`, `${id}-page`, ...), so more
   *  than one `DataTable` can coexist on the same page without their URL state colliding. */
  id: string;
  columns: DataTableColumn<T>[];
  /** The full, already-fetched dataset -- this component sorts/filters/paginates client-side
   *  over whatever it's given. Whether the caller fetches everything up front or narrows the
   *  query server-side first is that caller's own decision, not this component's concern. */
  data: T[];
  getRowId: (row: T) => string;
  /** The table's accessible name, rendered as a visually hidden `<caption>`. */
  caption?: React.ReactNode;
  emptyState?: React.ReactNode;
  pageSize?: number;
  filterPlaceholder?: string;
  selectable?: boolean;
  /** Names each selection checkbox after its own row, instead of a bare "select row". */
  getRowLabel?: (row: T) => string;
  onSelectionChange?: (selectedIds: string[]) => void;
}

const DEFAULT_PAGE_SIZE = 20;
const FILTER_DEBOUNCE_MS = 250;

/**
 * The one list-view table (brief §9/§10: "DataTable (sort/filter/paginate/URL sync/bulk
 * select)"). `"use client"`: genuinely interactive throughout (sortable headers, pagination
 * controls, a filter input, selection checkboxes) and reads/writes `searchParams` via
 * client-only hooks -- an inherently interactive leaf, not a layout or page needing justification
 * under brief rule 4.
 *
 * Sort, filter query, and current page are synced to `searchParams` (`${id}-sort`, `${id}-q`,
 * `${id}-page`) so the exact view is bookmarkable/shareable (brief §9: "Sharing a URL reproduces
 * the exact view") -- a deliberate correction of the legacy `SortableTable`
 * (`repos/web-app/src/components/widgets/SortableTable`), which persists sort order in
 * `localStorage` instead and has no URL state at all. Row **selection** is intentionally *not*
 * URL-synced: it's transient interaction state (which rows are checked right now for a bulk
 * action), not view state worth bookmarking, and persisting a potentially long ID list in the URL
 * would be exactly the kind of unbounded query string the deep-linking goal isn't about.
 *
 * **`columns` cannot be built in a Server Component and passed in as a prop** -- found live, not
 * from a doc: `cell`/`sortValue`/`filterValue`/`getRowId` are functions, and React's Server
 * Components can't serialize a function across the server/client boundary (confirmed with a real
 * "Functions cannot be passed directly to Client Components" error during this component's own
 * verification). The typical shape is a Server Component that fetches `data` (plain, serializable
 * objects) and passes it down into a small `"use client"` wrapper that defines `columns` itself
 * and renders `<DataTable>` -- the fetch stays server-side, the column/render config lives in the
 * client boundary alongside this component. Don't try to define `columns` in the page/Server
 * Component and hand them down; it will fail at runtime, not compile time.
 *
 * Its own chrome (pagination, the select-all label, the default empty text) reads from the `Table`
 * namespace via `useTranslations` -- a client-component hook, which works because
 * `NextIntlClientProvider` wraps the whole app in `app/[locale]/layout.tsx`. D-003 shipped these
 * strings hardcoded in English, which nothing caught while the only caller was the design-system
 * showcase; S-004 is the first screen where a Czech reader would have seen them.
 *
 * Wraps its own `useSearchParams()`-reading implementation in `<Suspense>` internally -- found
 * live, the hard way: Next.js requires any `useSearchParams()` caller to sit inside a Suspense
 * boundary or the page fails to prerender with "useSearchParams() should be wrapped in a suspense
 * boundary". `next dev` never surfaced this (no static-generation/prerender step to enforce it
 * against); a real `next build` -- specifically the one inside this repo's own Docker build, the
 * same production path every other ticket has been verified against -- caught it immediately.
 * Wrapping here, once, means every future caller just imports `DataTable` and it works, rather
 * than every S-/T-/AD- ticket that ever uses it needing to remember its own boundary.
 */
export function DataTable<T>(props: DataTableProps<T>) {
  return (
    <Suspense fallback={null}>
      <DataTableInner {...props} />
    </Suspense>
  );
}

function DataTableInner<T>({
  id,
  columns,
  data,
  getRowId,
  caption,
  emptyState,
  pageSize = DEFAULT_PAGE_SIZE,
  filterPlaceholder,
  selectable = false,
  getRowLabel,
  onSelectionChange,
}: DataTableProps<T>) {
  const t = useTranslations("Table");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sortKey = `${id}-sort`;
  const pageKey = `${id}-page`;
  const queryKey = `${id}-q`;

  const rawSort = searchParams.get(sortKey);
  const sortColumn = rawSort ? rawSort.replace(/^-/, "") : null;
  const sortDirection: SortDirection = rawSort?.startsWith("-") ? "desc" : "asc";
  // Memoized so the two memos below can depend on it without re-running on every render.
  const order = useMemo<DataTableOrder>(
    () => ({ sortColumn, sortDirection }),
    [sortColumn, sortDirection],
  );
  const currentPage = Math.max(1, Number(searchParams.get(pageKey) ?? "1") || 1);
  const urlQuery = searchParams.get(queryKey) ?? "";

  const [filterInput, setFilterInput] = useState(urlQuery);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectPageRef = useRef<HTMLInputElement>(null);

  // Keep the input in sync if the URL changes from elsewhere (e.g. back/forward navigation) --
  // React's documented pattern for "adjust state when a prop changes" (a conditional setState
  // call during render, not inside an effect: https://react.dev/learn/you-might-not-need-an-effect).
  // An effect here would cause an extra render pass and trips `react-hooks/set-state-in-effect`.
  const [prevUrlQuery, setPrevUrlQuery] = useState(urlQuery);
  if (urlQuery !== prevUrlQuery) {
    setPrevUrlQuery(urlQuery);
    setFilterInput(urlQuery);
  }

  function updateParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    router.replace({ pathname, query: Object.fromEntries(next.entries()) }, { scroll: false });
  }

  // Debounce the filter input's effect on the URL/re-filtering, not every keystroke. This one is
  // genuine effect material (a timer, an external API) -- it doesn't call setState itself.
  useEffect(() => {
    if (filterInput === urlQuery) return;
    const timeout = setTimeout(() => {
      updateParams({ [queryKey]: filterInput || null, [pageKey]: null });
    }, FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
    // Deliberately only re-runs on filterInput itself: re-including updateParams/urlQuery/etc.
    // would re-trigger on every searchParams change this same effect just caused.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterInput]);

  const filtered = useMemo(() => {
    if (!urlQuery) return data;
    const needle = urlQuery.toLowerCase();
    return data.filter((row) =>
      columns.some((column) => {
        const value = column.filterValue
          ? column.filterValue(row)
          : String(column.cell(row, order));
        return value.toLowerCase().includes(needle);
      }),
    );
  }, [data, urlQuery, columns, order]);

  const sorted = useMemo(() => {
    if (!sortColumn) return filtered;
    const column = columns.find((c) => c.id === sortColumn);
    if (!column) return filtered;
    const getValue = column.sortValue ?? ((row: T) => String(column.cell(row, order)));
    const withValues = filtered.map((row) => ({ row, value: getValue(row) }));
    withValues.sort((a, b) => {
      if (a.value < b.value) return sortDirection === "asc" ? -1 : 1;
      if (a.value > b.value) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return withValues.map(({ row }) => row);
  }, [filtered, sortColumn, sortDirection, columns, order]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clampedPage = Math.min(currentPage, totalPages);
  const pageRows = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  function handleSort(columnId: string) {
    if (sortColumn !== columnId) {
      updateParams({ [sortKey]: columnId, [pageKey]: null });
    } else if (sortDirection === "asc") {
      updateParams({ [sortKey]: `-${columnId}`, [pageKey]: null });
    } else {
      updateParams({ [sortKey]: null, [pageKey]: null });
    }
  }

  function handlePageChange(page: number) {
    updateParams({ [pageKey]: page === 1 ? null : String(page) });
  }

  function toggleRow(rowId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      onSelectionChange?.(Array.from(next));
      return next;
    });
  }

  function togglePage() {
    const pageIds = pageRows.map(getRowId);
    const allSelected = pageIds.every((rowId) => selectedIds.has(rowId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const rowId of pageIds) {
        if (allSelected) {
          next.delete(rowId);
        } else {
          next.add(rowId);
        }
      }
      onSelectionChange?.(Array.from(next));
      return next;
    });
  }

  const allPageRowsSelected =
    pageRows.length > 0 && pageRows.every((row) => selectedIds.has(getRowId(row)));
  const somePageRowsSelected = pageRows.some((row) => selectedIds.has(getRowId(row)));

  // `indeterminate` has no HTML attribute behind it -- it exists only as a DOM property, so JSX
  // can't set it and it has to be written onto the node itself.
  useEffect(() => {
    const node = selectPageRef.current;
    if (node) node.indeterminate = somePageRowsSelected && !allPageRowsSelected;
  }, [somePageRowsSelected, allPageRowsSelected]);

  const statusText =
    sorted.length === 0
      ? t("noResults")
      : t("showing", {
          from: (clampedPage - 1) * pageSize + 1,
          to: Math.min(clampedPage * pageSize, sorted.length),
          total: sorted.length,
        });

  return (
    <div className="flex flex-col gap-3">
      {filterPlaceholder !== undefined && (
        <input
          type="search"
          value={filterInput}
          onChange={(event) => setFilterInput(event.target.value)}
          placeholder={filterPlaceholder}
          aria-label={filterPlaceholder}
          className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring sm:w-auto"
        />
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {statusText}
      </p>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-sm">
          {caption !== undefined && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {selectable && (
                <th scope="col" className="w-10 px-3 py-2">
                  <input
                    ref={selectPageRef}
                    type="checkbox"
                    checked={allPageRowsSelected}
                    onChange={togglePage}
                    aria-label={t("selectPage")}
                  />
                </th>
              )}
              {columns.map((column) => {
                const active = sortColumn === column.id;
                return (
                  <th
                    key={column.id}
                    scope="col"
                    className={`px-3 py-2 font-medium ${column.align === "right" ? "text-right" : "text-left"} ${column.className ?? ""}`}
                    aria-sort={
                      column.sortable
                        ? active
                          ? sortDirection === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                        : undefined
                    }
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(column.id)}
                        className={`flex w-full items-center gap-1 hover:text-foreground ${
                          column.align === "right" ? "justify-end" : ""
                        }`}
                      >
                        {column.header}
                        {active && (
                          <span aria-hidden="true">{sortDirection === "asc" ? "↑" : "↓"}</span>
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  {emptyState ?? t("noRecords")}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => {
                const rowId = getRowId(row);
                return (
                  <tr
                    key={rowId}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    {selectable && (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(rowId)}
                          onChange={() => toggleRow(rowId)}
                          aria-label={
                            getRowLabel
                              ? t("selectRowNamed", { label: getRowLabel(row) })
                              : t("selectRow")
                          }
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        className={`px-3 py-2 ${column.align === "right" ? "text-right" : ""} ${column.className ?? ""}`}
                      >
                        {column.cell(row, order)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{statusText}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(clampedPage - 1)}
              disabled={clampedPage <= 1}
              className="rounded-md border border-input px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("previous")}
            </button>
            <span>{t("page", { page: clampedPage, total: totalPages })}</span>
            <button
              type="button"
              onClick={() => handlePageChange(clampedPage + 1)}
              disabled={clampedPage >= totalPages}
              className="rounded-md border border-input px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("next")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
