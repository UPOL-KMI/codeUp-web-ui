import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/lib/api/current-user";
import { getUserGroups, getUserProfile } from "@/lib/api/user-profile";

import { Link } from "@/i18n/navigation";
import { DateTime } from "@/components/format/date-time";
import { RelativeTime } from "@/components/format/relative-time";
import { PageShell, type BreadcrumbItem } from "@/components/page-shell";
import { EmptyState } from "@/components/state/empty-state";
import { Badge } from "@/components/status/badge";

/**
 * One person's profile (S-021): who they are, and where in ReCodEx they belong.
 *
 * A component rather than a page, because two routes render it: `/users/:id` and `/profile`, which
 * is the same screen about oneself. `/profile` was a redirect at first, and that was worse in two
 * ways -- an extra round trip on every visit, and a page that is mid-navigation when a caller
 * looks at it, which the token-leakage test caught immediately.
 *
 * **Every row here is a field core-api chose to send.** The private block -- email, role, when the
 * account was made, when it was last used -- exists in the response only under
 * `canViewPrivateData`, so a reader who may not see it gets a page with those rows absent rather
 * than blank. The groups section is the same idea with a different mechanism: a user object
 * carries no `permissionHints` at all (verified live), so the list is fetched and a 403 read as
 * "not disclosed", which is the section simply not being there.
 *
 * The groups link to the group, and to nothing else yet: the legacy profile also offers "user
 * solutions" per group, which is T-005's screen -- this page adds that link when that ticket lands
 * (noted on its row), rather than shipping a button to a 404 (DEC-066). Editing one's own account
 * is offered because S-022 built it; taking over an account is AD-003's and adds its own control
 * here when it lands.
 */
export async function ProfileView({
  userId,
  breadcrumbs,
}: {
  userId: string;
  breadcrumbs: BreadcrumbItem[];
}) {
  const locale = await getLocale();
  const [t, profile, viewer, groups] = await Promise.all([
    getTranslations("Profile"),
    getUserProfile(userId),
    getCurrentUser(),
    getUserGroups(userId, locale),
  ]);

  const isMe = viewer.id === profile.id;
  const externalIds = Object.entries(profile.externalIds);

  return (
    <PageShell
      title={profile.fullName || t("unnamed")}
      subtitle={isMe ? t("thisIsYou") : undefined}
      breadcrumbs={breadcrumbs}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {profile.isVerified ? (
            <Badge tone="success">{t("verified")}</Badge>
          ) : (
            <Badge tone="warning">{t("unverified")}</Badge>
          )}
          {profile.isAllowed === false && <Badge tone="warning">{t("disabled")}</Badge>}
          {isMe && (
            <Link
              href="/profile/edit"
              className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {t("editMine")}
            </Link>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-8">
        <section aria-labelledby="profile-overview">
          <h2 id="profile-overview" className="mb-3 text-base font-semibold tracking-tight">
            {t("overview")}
          </h2>
          <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            <Row label={t("name")}>
              {[
                profile.titlesBeforeName,
                profile.firstName,
                profile.lastName,
                profile.titlesAfterName,
              ]
                .filter(Boolean)
                .join(" ") || profile.fullName}
            </Row>
            {profile.email && (
              <Row label={t("email")}>
                <a
                  href={`mailto:${profile.email}`}
                  className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {profile.email}
                </a>
              </Row>
            )}
            {profile.role && <Row label={t("role")}>{t(`roles.${profile.role}`)}</Row>}
            {profile.createdAt !== null && (
              <Row label={t("createdAt")}>
                <DateTime unixSeconds={profile.createdAt} />
              </Row>
            )}
            {profile.lastAuthenticationAt !== null && (
              <Row label={t("lastAuthenticationAt")}>
                <span className="flex flex-wrap items-center gap-2">
                  <DateTime unixSeconds={profile.lastAuthenticationAt} />
                  <span className="text-muted-foreground">
                    <RelativeTime unixSeconds={profile.lastAuthenticationAt} />
                  </span>
                </span>
              </Row>
            )}
            {externalIds.map(([service, identifier]) => (
              <Row key={service} label={t("externalId", { service })}>
                <code className="text-xs">{identifier}</code>
              </Row>
            ))}
          </dl>
        </section>

        {groups !== null && (
          <section aria-labelledby="profile-groups">
            <h2 id="profile-groups" className="mb-3 text-base font-semibold tracking-tight">
              {t("groups")}
            </h2>
            {groups.length === 0 ? (
              <EmptyState title={t("noGroups.title")} description={t("noGroups.description")} />
            ) : (
              <ul className="flex flex-col gap-2">
                {groups.map((group) => (
                  <li
                    key={group.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
                  >
                    <Link
                      href={`/groups/${group.id}`}
                      className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {group.name}
                    </Link>
                    <Badge tone={group.role === "supervisor" ? "info" : "neutral"}>
                      {t(`membership.${group.role}`)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </PageShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm">{children}</dd>
    </div>
  );
}
