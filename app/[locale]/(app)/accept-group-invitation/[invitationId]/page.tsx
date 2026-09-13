import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getGroupInvitation } from "@/lib/api/group-invitation";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { DateTime } from "@/components/format/date-time";
import { RelativeTime } from "@/components/format/relative-time";
import { InvitationAccept } from "@/components/groups/invitation-accept";
import { Markdown } from "@/components/markdown/markdown";
import { PageShell } from "@/components/page-shell";
import { buttonClasses } from "@/components/button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "GroupInvitation" });
  return { title: t("title") };
}

/**
 * The page an invitation link leads to (S-023): what group this is, who runs it, and one button.
 *
 * **Reachable only with a session**, which is why it lives in `(app)` -- core-api needs to know
 * who is joining, and the invitation cannot be read at all without a token. Someone who follows
 * the link from an email while signed out is sent to `/login?from=...` by `proxy.ts` and returns
 * here afterwards.
 *
 * Whether the button appears is `permissionHints.acceptInvitation`, plus the two conditions
 * core-api checks that the hint does not carry (expiry, organizational). Each reason it can be
 * missing is stated rather than left to be inferred from a greyed-out control -- an invitation
 * link is often the reader's first contact with ReCodEx, and "nothing happened" is the worst thing
 * that page can say.
 */
export default async function AcceptGroupInvitationPage({
  params,
}: {
  params: Promise<{ invitationId: string }>;
}) {
  const [{ invitationId }, locale] = await Promise.all([params, getLocale()]);
  const [t, invitation] = await Promise.all([
    getTranslations("GroupInvitation"),
    getGroupInvitation(invitationId, locale),
  ]);
  const breadcrumbs = await resolveBreadcrumbs(`/accept-group-invitation/${invitationId}`, locale);
  const { group } = invitation;

  return (
    <PageShell
      title={t("title")}
      subtitle={group.path.length > 0 ? group.path.join(" / ") : undefined}
      breadcrumbs={breadcrumbs}
    >
      <div className="flex flex-col gap-8">
        <section aria-labelledby="invitation-group">
          <h2 id="invitation-group" className="mb-3 text-base font-semibold tracking-tight">
            {group.name || t("unnamedGroup")}
          </h2>
          {group.description ? (
            <Markdown source={group.description} />
          ) : (
            <p className="text-sm text-muted-foreground">{t("noDescription")}</p>
          )}
        </section>

        <section aria-labelledby="invitation-terms">
          <h2 id="invitation-terms" className="mb-3 text-base font-semibold tracking-tight">
            {t("terms")}
          </h2>
          <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            <div className="flex justify-between gap-4 border-b border-border py-2 sm:col-span-2">
              <dt className="text-sm text-muted-foreground">{t("admins")}</dt>
              <dd className="text-sm">
                {group.admins.length > 0 ? (
                  <ul className="flex flex-col items-end gap-0.5">
                    {group.admins.map((admin) => (
                      <li key={admin.id}>
                        <Link href={`/users/${admin.id}`} className="hover:underline">
                          {admin.fullName || admin.id}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted-foreground">{t("noAdmins")}</span>
                )}
              </dd>
            </div>

            {invitation.note && (
              <div className="flex justify-between gap-4 border-b border-border py-2 sm:col-span-2">
                <dt className="text-sm text-muted-foreground">{t("note")}</dt>
                <dd className="text-sm">{invitation.note}</dd>
              </div>
            )}

            <div className="flex justify-between gap-4 border-b border-border py-2">
              <dt className="shrink-0 text-sm text-muted-foreground">{t("expireAt")}</dt>
              <dd className="text-sm">
                {invitation.expireAt !== null ? (
                  <span className="flex flex-col items-end">
                    <DateTime unixSeconds={invitation.expireAt} />
                    <span className="text-xs text-muted-foreground">
                      <RelativeTime unixSeconds={invitation.expireAt} />
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">{t("neverExpires")}</span>
                )}
              </dd>
            </div>

            <div className="flex justify-between gap-4 border-b border-border py-2">
              <dt className="shrink-0 text-sm text-muted-foreground">{t("createdAt")}</dt>
              <dd className="text-sm">
                <DateTime unixSeconds={invitation.createdAt} />
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="invitation-action">
          <h2 id="invitation-action" className="mb-3 text-base font-semibold tracking-tight">
            {t("joining")}
          </h2>
          {invitation.alreadyMember ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{t("alreadyMember")}</p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/groups/${group.id}?tab=assignments`}
                  className={buttonClasses("primary", "sm")}
                >
                  {t("goToAssignments")}
                </Link>
                <Link href={`/groups/${group.id}`} className={buttonClasses("outline", "sm")}>
                  {t("goToGroup")}
                </Link>
              </div>
            </div>
          ) : invitation.canAccept ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{t("enrolsYouAsStudent")}</p>
              <InvitationAccept invitationId={invitation.id} />
            </div>
          ) : (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {invitation.hasExpired
                ? t("expired")
                : group.organizational
                  ? t("organizational")
                  : group.archived
                    ? t("archived")
                    : t("notAllowed")}
            </p>
          )}
        </section>
      </div>
    </PageShell>
  );
}
