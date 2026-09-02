import { getLocale, getTranslations } from "next-intl/server";

import { canSeeAdminSection, getCurrentUser } from "@/lib/api/current-user";
import { getMyGroups } from "@/lib/api/groups";
import { getActiveSystemMessages } from "@/lib/api/system-messages";

import { ActiveMessages } from "@/components/messages/active-messages";

import { SidebarNav, type NavSection } from "./sidebar-nav";

/**
 * The application shell (D-014) -- the gap found during D-001, when `PageShell` was built and it
 * became clear nothing owned the frame it sits inside. `docs/IA.md` §3.1 specifies the sections
 * and, importantly, their *visibility rules*: "My Groups" and "My Teaching" come from per-group
 * membership rather than the global role, and are not mutually exclusive -- someone supervising
 * one course while taking another sees both.
 *
 * A Server Component that fetches once and passes plain labels to the client island. Two
 * consequences worth stating: no group data crosses the boundary beyond the names already
 * rendered (brief §6.5), and the sidebar is present in the initial HTML rather than popping in
 * after a client-side fetch.
 *
 * Sections whose destination does not exist yet are simply absent rather than rendered as dead
 * links -- the routes listed here are all real entries in `app/[locale]/(app)/`.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  // `getLocale()` reads next-intl's request config rather than core-api, so awaiting it first costs
  // nothing and keeps the three reads below in one wave -- none of them derives from another, and
  // each calls `requireSession()` itself, so ordering them would authorise nothing.
  const locale = await getLocale();
  const [t, user, groups, broadcasts] = await Promise.all([
    getTranslations("Nav"),
    getCurrentUser(),
    getMyGroups(locale),
    getActiveSystemMessages(),
  ]);

  // core-api keeps one "seen up to" timestamp rather than a flag per message (AD-007), so unread
  // is everything published since. A message written in neither of this app's languages is
  // dropped rather than rendered blank -- `localizedTexts` may hold any subset.
  const unread = broadcasts
    .filter((message) => message.visibleFrom > (user.messagesReadUpTo ?? 0))
    .map((message) => ({
      id: message.id,
      type: message.type,
      visibleFrom: message.visibleFrom,
      text: (message.texts.find((text) => text.locale === locale) ?? message.texts[0])?.text ?? "",
    }))
    .filter((message) => message.text !== "");

  const sections: NavSection[] = [
    {
      id: "dashboard",
      title: t("dashboard"),
      items: [{ href: "/dashboard", label: t("home") }],
    },
    {
      id: "groups",
      title: t("myGroups"),
      items: groups.member.map((group) => ({ href: `/groups/${group.id}`, label: group.name })),
    },
    // IA §3.1: shown "only if any exist" -- an empty teaching section on a student's sidebar is
    // noise, whereas an empty "My Groups" still tells a new student where their courses will
    // appear once they enrol.
    ...(groups.teaching.length > 0
      ? [
          {
            id: "teaching",
            title: t("myTeaching"),
            items: groups.teaching.map((group) => ({
              href: `/groups/${group.id}`,
              label: group.name,
            })),
          },
        ]
      : []),
    {
      id: "exercises",
      title: t("exercises"),
      items: [
        { href: "/exercises", label: t("exerciseCatalog") },
        { href: "/pipelines", label: t("pipelines") },
      ],
    },
    {
      id: "people",
      title: t("people"),
      items: [
        { href: "/profile", label: t("profile") },
        { href: "/users", label: t("users") },
      ],
    },
    ...(canSeeAdminSection(user.role)
      ? [
          {
            id: "admin",
            title: t("admin"),
            items: [
              { href: "/admin", label: t("server") },
              { href: "/admin/instances", label: t("instances") },
              { href: "/system-messages", label: t("systemMessages") },
              { href: "/archive", label: t("archive") },
              { href: "/submission-failures", label: t("submissionFailures") },
            ],
          },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* First in the tab order, before the sidebar's one link per enrolled and taught group. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:text-foreground focus:ring-2 focus:ring-ring"
      >
        {t("skipToContent")}
      </a>
      <SidebarNav sections={sections} />
      {/* The page's landmark, so assistive technology can jump past the sidebar -- and so a
          heading in the page cannot be confused with the identically-named sidebar section.
          `tabIndex={-1}` so the skip link moves focus rather than only the scroll position. */}
      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">
        {/* Above the page rather than behind a bell in a header: a broadcast worth writing is
            worth reading without opening a dropdown, and this shell has no header to hang one on
            (DEC-115). */}
        <ActiveMessages messages={unread} userId={user.id} />
        {children}
      </main>
    </div>
  );
}
