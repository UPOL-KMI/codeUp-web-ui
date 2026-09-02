import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/lib/api/current-user";
import { getInstance, getInstanceLicences } from "@/lib/api/instances";
import { getUserProfile } from "@/lib/api/user-profile";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { Markdown } from "@/components/markdown/markdown";
import { DateTime } from "@/components/format/date-time";
import { InstanceSettings } from "@/components/instances/instance-settings";
import { LicenceManager } from "@/components/instances/licence-manager";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/status/badge";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Instances" });
  return { title: t("detailTitle") };
}

/**
 * One instance: what it is, whether people may join it, and the licences it runs on
 * (AD-005 and AD-008 on one screen).
 *
 * **The legacy app spreads this over two pages and this one merges them**, because the second has
 * a single checkbox on it: `POST /v1/instances/{id}` accepts `{isOpen}` and nothing else. An
 * instance's name and description belong to its **root group**, so they are shown here and edited
 * where groups are edited (S-009), which the link below goes to rather than a form that could not
 * save.
 *
 * **Licences are the substance of this screen.** `hasValidLicence` is core-api's own verdict, and
 * an instance without one is a deployment that has stopped working -- so the reason is spelt out
 * per licence (revoked, or expired) rather than left as one red word at the top.
 *
 * Superadmin only, and that is this page's own decision: `viewDetail` is public and `viewLicences`
 * is not, so a page that simply rendered would show an `empowered-supervisor` a licence section
 * that 403s. An instance carries no `permissionHints` to ask instead (DEC-110's shape once more).
 */
export default async function InstancePage({
  params,
}: {
  params: Promise<{ instanceId: string }>;
}) {
  const [{ instanceId }, locale, viewer] = await Promise.all([
    params,
    getLocale(),
    getCurrentUser(),
  ]);

  if (viewer.role !== "superadmin") forbidden();

  const [t, instance, licences, breadcrumbs] = await Promise.all([
    getTranslations("Instances"),
    getInstance(instanceId),
    getInstanceLicences(instanceId),
    resolveBreadcrumbs(`/admin/instances/${instanceId}`, locale),
  ]);

  // The administrator is an id on the instance and a name nowhere, so it costs one read -- the
  // same one the profile screen makes, memoized per request.
  const admin = instance.adminId ? await getUserProfile(instance.adminId).catch(() => null) : null;

  return (
    <PageShell
      title={instance.name || t("unnamed")}
      subtitle={t("detailSubtitle")}
      breadcrumbs={breadcrumbs}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {instance.hasValidLicence ? (
            <Badge tone="success">{t("flags.licensed")}</Badge>
          ) : (
            <Badge tone="danger">{t("flags.unlicensed")}</Badge>
          )}
          {instance.isOpen ? (
            <Badge tone="info">{t("flags.open")}</Badge>
          ) : (
            <Badge tone="neutral">{t("flags.closed")}</Badge>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-10">
        <section aria-labelledby="instance-about">
          <h2 id="instance-about" className="mb-3 text-base font-semibold tracking-tight">
            {t("about.title")}
          </h2>
          <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5 border-b border-border py-2">
              <dt className="text-xs text-muted-foreground">{t("about.admin")}</dt>
              <dd className="text-sm">
                {admin ? (
                  <Link
                    href={`/users/${admin.id}`}
                    className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {admin.fullName}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 border-b border-border py-2">
              <dt className="text-xs text-muted-foreground">{t("about.created")}</dt>
              <dd className="text-sm">
                {instance.createdAt === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <DateTime unixSeconds={instance.createdAt} dateOnly />
                )}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 border-b border-border py-2">
              <dt className="text-xs text-muted-foreground">{t("about.rootGroup")}</dt>
              <dd className="text-sm">
                {instance.rootGroupId ? (
                  <Link
                    href={`/groups/${instance.rootGroupId}`}
                    className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {t("about.openRootGroup")}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
          </dl>

          {instance.description ? (
            <div className="mt-4">
              <Markdown source={instance.description} />
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">{t("about.noDescription")}</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{t("about.nameLivesOnGroup")}</p>
        </section>

        <section aria-labelledby="instance-settings">
          <h2 id="instance-settings" className="mb-3 text-base font-semibold tracking-tight">
            {t("settings.title")}
          </h2>
          <InstanceSettings
            instance={instance}
            deletable={!viewer.instanceIds.includes(instance.id)}
          />
        </section>

        <section aria-labelledby="instance-licences">
          <h2 id="instance-licences" className="mb-3 text-base font-semibold tracking-tight">
            {t("licences.title")}
          </h2>
          <LicenceManager
            instanceId={instance.id}
            licences={licences}
            hasValidLicence={instance.hasValidLicence}
          />
        </section>
      </div>
    </PageShell>
  );
}
