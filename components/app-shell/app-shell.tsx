import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";

import { canSeeAdminSection, getCurrentUser } from "@/lib/api/current-user";
import { getMyGroups } from "@/lib/api/groups";
import { getActiveSystemMessages } from "@/lib/api/system-messages";

import { ActiveMessages } from "@/components/messages/active-messages";
import { Skeleton } from "@/components/state/skeleton";

import { ViewAsBanner } from "./view-as-banner";

import { SidebarNav, type NavSection } from "./sidebar-nav";

/**
 * The application shell (D-014) -- the gap found during D-001, when `PageShell` was built and it
 * became clear nothing owned the frame it sits inside.
 *
 * **This component fetches nothing, and that is PF-002.** It used to be one `async` function that
 * awaited four core-api calls before returning any JSX -- and `{children}` is part of that JSX, so
 * **no page under `(app)` could start its own fetching until the shell had finished its own**.
 * Time to a rendered page was shell + page rather than `max(shell, page)`; on
 * `/solutions/[id]/sources` that put two shell hops in front of six page ones. P-003 collapsed the
 * shell's own two stages into one (DEC-119) and could not fix this, because the fix is structural:
 * the two things that fetch are now siblings of `{children}`, each inside its own `<Suspense>`
 * boundary, which is what Next's own bundled `loading.md` prescribes.
 *
 * Two consequences, one of them visible. **`(app)/loading.tsx` becomes reachable** -- the route
 * group has had a `PageSkeleton` that nothing could ever show, because the boundary the layout puts
 * around `{children}` was itself inside an unresolved async component. And **the sidebar streams
 * in** rather than being in the first byte, which is the trade this ticket accepted: it is the
 * frame around the page rather than the page, and its fallback holds its width so nothing shifts
 * when it arrives.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Suspense fallback={<SidebarFallback />}>
        <Sidebar />
      </Suspense>
      {/* The page's landmark, so assistive technology can jump past the sidebar -- and so a
          heading in the page cannot be confused with the identically-named sidebar section.
          `tabIndex={-1}` so the skip link moves focus rather than only the scroll position. */}
      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">
        {/* Above the page rather than behind a bell in a header: a broadcast worth writing is
            worth reading without opening a dropdown, and this shell has no header to hang one on
            (DEC-115). Its own boundary, and no fallback: an absent banner is the ordinary case,
            and a placeholder for one would be a box that usually turns out to be nothing. */}
        <Suspense fallback={null}>
          <Notices />
        </Suspense>
        {children}
      </main>
    </div>
  );
}

/**
 * Holds the sidebar's width while it is being fetched, so the page beside it does not shift when
 * it arrives. `aria-busy` rather than nothing at all: something *is* there, it is not ready yet.
 */
function SidebarFallback() {
  return (
    <aside
      aria-busy="true"
      className="w-full shrink-0 border-border bg-card md:block md:w-64 md:border-r"
    >
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
      </div>
    </aside>
  );
}

/**
 * Everything the sidebar shows, read in one wave. `docs/IA.md` §3.1 specifies the sections and,
 * importantly, their *visibility rules*: "My Groups" and "My Teaching" come from per-group
 * membership rather than the global role, and are not mutually exclusive -- someone supervising one
 * course while taking another sees both.
 *
 * A Server Component that passes plain labels to the client island: no group data crosses the
 * boundary beyond the names already rendered (brief §6.5).
 *
 * Sections whose destination does not exist yet are simply absent rather than rendered as dead
 * links -- the routes listed here are all real entries in `app/[locale]/(app)/`.
 */
async function Sidebar() {
  // `getLocale()` reads next-intl's request config rather than core-api, so awaiting it first costs
  // nothing and keeps the two reads below in one wave -- neither derives from the other, and each
  // calls `requireSession()` itself, so ordering them would authorise nothing.
  const locale = await getLocale();
  const [t, user, groups] = await Promise.all([
    getTranslations("Nav"),
    getCurrentUser(),
    getMyGroups(locale),
  ]);

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
    <>
      {/* First in the tab order, before the sidebar's one link per enrolled and taught group. It
          lives inside this boundary rather than in the synchronous shell above because its label
          needs the message catalogue, and reaching for that is the one `await` that would put the
          whole frame back in front of the page. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:text-foreground focus:ring-2 focus:ring-ring"
      >
        {t("skipToContent")}
      </a>
      <SidebarNav sections={sections} />
    </>
  );
}

/**
 * What the app has to say to this reader before the page does: which role this session is acting
 * as (G-023), and the broadcasts they have not seen (AD-007).
 *
 * One boundary for both because they are one wave — both need the current user, which is memoized
 * per request, so splitting them would buy nothing and cost a second placeholder.
 *
 * core-api keeps one "seen up to" timestamp rather than a flag per message, so unread is
 * everything published since. A message written in neither of this app's languages is dropped
 * rather than rendered blank -- `localizedTexts` may hold any subset.
 */
async function Notices() {
  const locale = await getLocale();
  const [user, broadcasts] = await Promise.all([getCurrentUser(), getActiveSystemMessages()]);

  const unread = broadcasts
    .filter((message) => message.visibleFrom > (user.messagesReadUpTo ?? 0))
    .map((message) => ({
      id: message.id,
      type: message.type,
      visibleFrom: message.visibleFrom,
      text: (message.texts.find((text) => text.locale === locale) ?? message.texts[0])?.text ?? "",
    }))
    .filter((message) => message.text !== "");

  return (
    <>
      {/* G-023. Before the broadcasts: what this session can currently do frames everything else
          on the page. */}
      {user.role !== user.accountRole && <ViewAsBanner role={user.role} />}
      <ActiveMessages messages={unread} userId={user.id} />
    </>
  );
}
