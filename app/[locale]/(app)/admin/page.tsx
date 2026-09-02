import { forbidden } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/lib/api/current-user";
import { ASYNC_JOB_WINDOW_SECONDS, getAsyncJobs, getBrokerStats } from "@/lib/api/server";
import { resolveBreadcrumbsForNamespace } from "@/lib/breadcrumbs/manifest";

import { AsyncJobs } from "@/components/admin/async-jobs";
import { BrokerPanel } from "@/components/admin/broker-panel";
import { PageShell } from "@/components/page-shell";

/**
 * The backend services this deployment runs on (AD-006) -- the `/admin` placeholder the sidebar has
 * linked to since D-014.
 *
 * **`BACKLOG.md` said "runtime environments, hardware groups"; the legacy page contains neither**
 * (DEC-114). Its `ServerManagement` screen is these two panels: the ZeroMQ broker that hands
 * evaluation jobs to workers, and core-api's own background job queue. Runtime environments and
 * hardware groups have no administration screen anywhere in the legacy app -- they are read-only
 * vocabularies that appear where exercises are configured (T-009) and where their limits are set
 * (T-010), and both of those are built.
 *
 * Superadmin only, as the legacy page is: `permissions.neon` carries no `resource: broker` rule at
 * all, so only the blanket superadmin allow reaches the stats, and a supervisor is refused them and
 * the ping with 403 (verified). The job list is the odd one out -- `asyncJob.list` is granted to
 * every role -- but a supervisor's copy of it is empty, and half a page is not a page.
 */
export default async function ServerManagementPage() {
  const [locale, viewer] = await Promise.all([getLocale(), getCurrentUser()]);
  if (viewer.role !== "superadmin") forbidden();

  const [t, stats, jobs, breadcrumbs] = await Promise.all([
    getTranslations("Server"),
    getBrokerStats(),
    getAsyncJobs(),
    resolveBreadcrumbsForNamespace("Admin", locale),
  ]);

  return (
    <PageShell title={t("title")} subtitle={t("subtitle")} breadcrumbs={breadcrumbs}>
      <div className="flex flex-col gap-10">
        <section aria-labelledby="server-broker">
          <h2 id="server-broker" className="mb-3 text-base font-semibold tracking-tight">
            {t("broker.title")}
          </h2>
          <BrokerPanel stats={stats} />
        </section>

        <section aria-labelledby="server-jobs">
          <h2 id="server-jobs" className="mb-3 text-base font-semibold tracking-tight">
            {t("jobs.title")}
          </h2>
          <AsyncJobs jobs={jobs} windowSeconds={ASYNC_JOB_WINDOW_SECONDS} />
        </section>
      </div>
    </PageShell>
  );
}
