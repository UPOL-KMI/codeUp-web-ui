import { getLocale, getTranslations } from "next-intl/server";

import { canSeeAdminSection, getCurrentUser } from "@/lib/api/current-user";
import { getMyGroups } from "@/lib/api/groups";

import { CommandPalette } from "@/components/command-palette/command-palette";

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
  const [locale, t, user] = await Promise.all([
    getLocale(),
    getTranslations("Nav"),
    getCurrentUser(),
  ]);
  const groups = await getMyGroups(locale);

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
      {/* Mounted once here rather than per page: Cmd/Ctrl-K has to work from anywhere behind the
          session, and a palette that only exists on some screens is worse than none. */}
      <CommandPalette />
      <SidebarNav sections={sections} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
