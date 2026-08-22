import { Link } from "@/i18n/navigation";

export interface BreadcrumbItem {
  label: string;
  /** Omitted on the last crumb (the current page), and on any segment that names a section with
   *  no page of its own -- both render as plain text rather than as a link. */
  href?: string;
}

export interface PageShellProps {
  title: string;
  subtitle?: string;
  breadcrumbs: BreadcrumbItem[];
  /** Primary + secondary actions, right-aligned next to the title. */
  actions?: React.ReactNode;
  /** Pre-built tab navigation (this component only provides the slot, not tab semantics). */
  tabs?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The one page header/layout shell (brief §9: "No page builds its own header... consistent
 * layout, spacing, and responsive behavior"; footgun #12: breadcrumbs come from one mechanism).
 * `breadcrumbs` is a required prop, not resolved here -- D-002's central route manifest owns
 * turning a route into `BreadcrumbItem[]` (including async entity-name resolvers for groups,
 * assignments, exercises); this component only renders whatever list it's given, keeping it a
 * plain Server Component with no data dependency of its own.
 *
 * A Server Component, not `"use client"`: nothing here is interactive on its own (`actions` and
 * `tabs` are pre-built `ReactNode`s the caller supplies, already client components if they need
 * to be -- brief rule 4's "'use client' goes on interactive leaves only").
 */
export function PageShell({
  title,
  subtitle,
  breadcrumbs,
  actions,
  tabs,
  children,
}: PageShellProps) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1.5">
            {breadcrumbs.map((crumb, index) => (
              <li key={index} className="flex items-center gap-1.5">
                {index > 0 && (
                  <span aria-hidden="true" className="text-muted-foreground/60">
                    /
                  </span>
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="transition-colors hover:text-foreground hover:underline"
                  >
                    {crumb.label}
                  </Link>
                ) : index === breadcrumbs.length - 1 ? (
                  <span aria-current="page" className="font-medium text-foreground">
                    {crumb.label}
                  </span>
                ) : (
                  // A section with no page of its own. Plain text, and deliberately *not*
                  // `aria-current="page"` -- that attribute names the one crumb the user is on.
                  <span>{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {tabs && <div className="mt-6 border-b border-border">{tabs}</div>}

      <div className="mt-6">{children}</div>
    </div>
  );
}
