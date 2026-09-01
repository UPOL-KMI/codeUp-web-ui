"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitch } from "./locale-switch";

/**
 * The interactive half of the app shell (D-014): collapse, the mobile drawer, and the active-link
 * state. Everything it renders is computed on the server and handed down as `sections` -- this
 * component performs no data access, so the sidebar's contents (which depend on the user's group
 * memberships and role) never reach the client as anything but the labels already rendered.
 *
 * Active state is derived from `usePathname()` rather than tracked in state, so it is correct on
 * first paint and after any navigation, including a browser back. Note this is the **locale-aware**
 * `usePathname` from `@/i18n/navigation`, which strips the `/en` or `/cs` prefix -- the one from
 * `next/navigation` would return `/en/groups` and match nothing.
 */
export interface NavItem {
  href: string;
  label: string;
}

export interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
}

export function SidebarNav({ sections }: { sections: NavSection[] }) {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const nav = (
    <nav aria-label={t("primary")} className="flex flex-col gap-5 p-4">
      {sections.map((section) => (
        <div key={section.id} className="flex flex-col gap-1">
          <h2 className="px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {section.title}
          </h2>
          {section.items.length === 0 ? (
            <p className="px-2 py-1 text-sm text-muted-foreground">{t("emptySection")}</p>
          ) : (
            section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                onClick={() => setMobileOpen(false)}
                className={`truncate rounded-md px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive(item.href)
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-foreground hover:bg-accent/60"
                }`}
              >
                {item.label}
              </Link>
            ))
          )}
        </div>
      ))}
      {/* A-008. At the foot of the sidebar rather than in the page header: it is a preference,
          not an action on whatever is on screen. */}
      <div className="mt-2 border-t border-border pt-3">
        <LocaleSwitch />
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile: a disclosure button and a drawer. Brief §9 requires phone width to work --
          "students check deadlines on phones" -- and a permanently-visible sidebar would eat most
          of a phone screen. */}
      <div className="flex items-center gap-2 border-b border-border p-2 md:hidden">
        <button
          type="button"
          aria-expanded={mobileOpen}
          aria-controls="app-sidebar"
          onClick={() => setMobileOpen((open) => !open)}
          className="rounded-md border border-input px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {mobileOpen ? t("closeMenu") : t("openMenu")}
        </button>
      </div>

      <aside
        id="app-sidebar"
        className={`w-full shrink-0 border-border bg-card md:block md:w-64 md:border-r ${
          mobileOpen ? "block border-b" : "hidden"
        }`}
      >
        {nav}
      </aside>
    </>
  );
}
