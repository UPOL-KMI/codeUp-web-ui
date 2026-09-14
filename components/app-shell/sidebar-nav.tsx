"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import { BrandMark } from "@/components/brand/brand-mark";
import { Link, usePathname } from "@/i18n/navigation";

import { LocaleSwitch } from "./locale-switch";
import { ThemeToggle } from "./theme-toggle";
import { buttonClasses } from "@/components/button";

/** cmdk and the Radix dialog it renders through are ~34 KB of JS that most sessions never open, so
 *  they load on the first Ctrl-K or click rather than on every authenticated page. */
const CommandPalette = dynamic(
  () => import("@/components/command-palette/command-palette").then((mod) => mod.CommandPalette),
  { ssr: false },
);

/** Same bargain as the palette above (G-025): a QR encoder and a second Radix dialog are dead
 *  weight on every authenticated page for a feature used in front of a lecture room. `ssr: false`
 *  is also what makes reading `window.location.href` during its render safe. */
const PageQrCode = dynamic(() => import("./page-qr-code").then((mod) => mod.PageQrCode), {
  ssr: false,
});

/**
 * The skip link, first in the tab order (P-002), and a client component for one reason: PF-002
 * made `AppShell` synchronous so a page's own fetching does not queue behind the shell's, and an
 * `await getTranslations()` for these three words would have made it asynchronous again -- which
 * would either block `children` or put the skip link behind a `<Suspense>`, where a keyboard user
 * can reach the page before the link that exists to get them there.
 *
 * It lives in this module rather than its own so it costs no second client chunk: `Nav` is already
 * in `SHELL_MESSAGE_NAMESPACES` (PF-001) and this file is already the shell's always-loaded
 * client half.
 */
export function SkipToContent() {
  const t = useTranslations("Nav");
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:text-foreground focus:ring-2 focus:ring-ring"
    >
      {t("skipToContent")}
    </a>
  );
}

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
  /** Absent on a section that is one link -- a heading over a single item says nothing twice. */
  title?: string;
  items: NavItem[];
}

export function SidebarNav({ sections }: { sections: NavSection[] }) {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteRequested, setPaletteRequested] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState("");

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  // Only the exact route is *the* current page; an ancestor whose subtree the reader is inside is
  // merely the current item of the set, which is what the generic `true` means.
  const currentPage = (href: string) =>
    pathname === href ? "page" : isActive(href) ? "true" : undefined;

  const openPalette = () => {
    setPaletteRequested(true);
    setPaletteOpen(true);
  };

  // Cmd/Ctrl-K has to be listened for here, in the half that is always loaded: `CommandPalette`
  // carries the same listener, but it does not exist until this one pulls its chunk in. It is
  // dropped the moment the palette is mounted -- two listeners would toggle twice and cancel out.
  useEffect(() => {
    if (paletteRequested) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPaletteRequested(true);
        setPaletteOpen(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [paletteRequested]);

  const nav = (
    <nav aria-label={t("primary")} className="flex flex-col gap-5 p-4">
      {sections.map((section) => (
        <div key={section.id} className="flex flex-col gap-1">
          {section.title && (
            <h2 className="px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {section.title}
            </h2>
          )}
          {section.items.length === 0 ? (
            <p className="px-2 py-1 text-sm text-muted-foreground">{t("emptySection")}</p>
          ) : (
            section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={currentPage(item.href)}
                onClick={() => setMobileOpen(false)}
                className={`truncate rounded-md border-l-2 px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive(item.href)
                    ? "border-primary bg-accent font-medium text-accent-foreground"
                    : "border-transparent text-foreground hover:bg-accent/60"
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
      <div className="mt-2 flex flex-col gap-3 border-t border-border pt-3">
        <div className="flex items-center justify-between gap-2">
          <LocaleSwitch />
          <ThemeToggle />
        </div>
        {/* G-025. Beside the locale switch because it is chrome about the page you are
            on rather than an action on its contents -- the legacy app kept it in the header, which
            is where this app puts a page's own actions. */}
        <button
          type="button"
          onClick={() => {
            // Captured here, on the click: this is the moment the page is known, and it keeps
            // `PageQrCode` a pure function of its props.
            setQrUrl(window.location.href);
            setQrOpen(true);
            setMobileOpen(false);
          }}
          className="rounded-md px-2 py-1.5 text-left text-sm text-foreground outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("qr.open")}
        </button>
      </div>
    </nav>
  );

  return (
    <>
      {/* Mounted here rather than in `AppShell`: this is the shell's only always-mounted client
          component, so it is the one that can hold the state both triggers below share. */}
      {paletteRequested && <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />}
      {qrUrl !== "" && <PageQrCode url={qrUrl} open={qrOpen} onOpenChange={setQrOpen} />}

      {/* Mobile: a disclosure button and a drawer. Brief §9 requires phone width to work --
          "students check deadlines on phones" -- and a permanently-visible sidebar would eat most
          of a phone screen. */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 md:hidden">
        <BrandMark href="/dashboard" compact />
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-controls="app-sidebar"
            onClick={() => setMobileOpen((open) => !open)}
            className={buttonClasses("outline", "sm")}
          >
            {mobileOpen ? t("closeMenu") : t("openMenu")}
          </button>
          <PaletteTrigger onOpen={openPalette} className="px-3 py-1.5" />
        </div>
      </div>

      <aside
        id="app-sidebar"
        className={`w-full shrink-0 border-border bg-card md:block md:w-64 md:border-r ${
          mobileOpen ? "block border-b" : "hidden"
        }`}
      >
        {/* Hidden below md, where the copy in the bar above is reachable without opening the
            drawer this sits inside. */}
        <div className="hidden flex-col gap-4 px-4 pt-4 md:flex">
          <BrandMark href="/dashboard" />
          <PaletteTrigger onOpen={openPalette} className="w-full px-2 py-1.5 text-left" />
        </div>
        {nav}
      </aside>
    </>
  );
}

/** Deliberately not exported from `command-palette.tsx` and imported: a static import of anything
 *  from that module puts it -- and cmdk with it -- back in this always-loaded chunk, which is the
 *  whole cost the dynamic boundary above exists to defer. */
function PaletteTrigger({ onOpen, className }: { onOpen: () => void; className: string }) {
  const t = useTranslations("Palette");

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`rounded-md border border-input text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
    >
      {t("open")}
    </button>
  );
}
