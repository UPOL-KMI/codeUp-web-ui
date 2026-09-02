import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { canSeeAdminSection, getCurrentUser } from "@/lib/api/current-user";
import { getInstances } from "@/lib/api/instances";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { DateTime } from "@/components/format/date-time";
import { CreateInstance } from "@/components/instances/create-instance";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/state/empty-state";
import { Badge } from "@/components/status/badge";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Instances" });
  return { title: t("title") };
}

/**
 * The instances this deployment runs (AD-004).
 *
 * **Reading this list is public** -- core-api grants `instance.viewAll` to the `unauthenticated`
 * role, which is how the registration form offers a choice of instance before anybody signs in
 * (A-003). The gate below is therefore **not** an authorisation claim and does not pretend to be
 * one: nothing here is secret, and a student who wants these names can read them from
 * `/v1/instances` without a token or from the registration form. It is about where the page lives.
 * `/admin/*` is a section `docs/IA.md` §3.1 gives to superadmins and empowered supervisors, and a
 * route inside it that anybody can open is a navigation bug -- found by opening it as a student.
 * What the section's other half (an `empowered-supervisor`) is still withheld is the controls,
 * because creating and deleting are the superadmin's alone (verified live, 403 for a supervisor).
 *
 * Not a `DataTable` and not paginated, for a third reason again: a deployment has a handful of
 * instances, core-api serves them as a bare array, and sorting three rows in the browser is a
 * control that answers a question nobody asked. The list is fetched whole and ordered by name in
 * the reader's own locale.
 *
 * Each row's own screen is where the settings and the licences are; the count of instances is
 * usually one, and this page exists mostly to get there.
 */
export default async function InstancesPage() {
  const [locale, viewer] = await Promise.all([getLocale(), getCurrentUser()]);
  if (!canSeeAdminSection(viewer.role)) forbidden();

  const [t, list, breadcrumbs] = await Promise.all([
    getTranslations("Instances"),
    getInstances(locale),
    resolveBreadcrumbs("/admin/instances", locale),
  ]);

  const manageable = viewer.role === "superadmin";

  return (
    <PageShell title={t("title")} subtitle={t("subtitle")} breadcrumbs={breadcrumbs}>
      <div className="flex flex-col gap-4">
        {manageable && <CreateInstance />}

        {list.instances.length === 0 ? (
          <EmptyState title={t("empty.title")} description={t("empty.description")} />
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    {t("columns.name")}
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    {t("columns.admin")}
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    {t("columns.licence")}
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    {t("columns.created")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.instances.map((instance) => (
                  <tr
                    key={instance.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-3 py-2">
                      <span className="flex flex-col gap-1">
                        <Link
                          href={`/admin/instances/${instance.id}`}
                          className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          {instance.name || t("unnamed")}
                        </Link>
                        <span className="flex flex-wrap gap-1">
                          {instance.isOpen ? (
                            <Badge tone="info">{t("flags.open")}</Badge>
                          ) : (
                            <Badge tone="neutral">{t("flags.closed")}</Badge>
                          )}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {instance.adminId && list.admins.get(instance.adminId) ? (
                        <Link
                          href={`/users/${instance.adminId}`}
                          className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          {list.admins.get(instance.adminId)}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {instance.hasValidLicence ? (
                        <Badge tone="success">{t("flags.licensed")}</Badge>
                      ) : (
                        <Badge tone="danger">{t("flags.unlicensed")}</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {instance.createdAt === 0 ? (
                        "—"
                      ) : (
                        <DateTime unixSeconds={instance.createdAt} dateOnly />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}
