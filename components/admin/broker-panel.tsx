"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { freezeBroker, unfreezeBroker } from "@/lib/actions/server";
import type { BrokerStats } from "@/lib/api/server";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { Badge } from "@/components/status/badge";
import { useToast } from "@/components/toast/toast-provider";

/**
 * The ZeroMQ broker: what it is doing, and the one switch that stops it (AD-006).
 *
 * **The stat names are core-api's and are not translated.** It answers a flat map --
 * `queued-jobs`, `idle-worker-count`, `failed-jobs` and so on -- with no schema and no promise
 * about which keys exist; a table that renamed them would be a guess that goes stale the first
 * time the broker gains a counter. They are rendered as given, in a monospace column, the way the
 * legacy page renders them.
 *
 * **Only one of freeze and unfreeze is ever offered**, because the answer is in the stats:
 * `is-frozen` arrives as `"0"` or `"1"`. Showing both and letting core-api reject the wrong one
 * would be offering an action that cannot apply.
 */
export function BrokerPanel({ stats }: { stats: BrokerStats }) {
  const t = useTranslations("Server.broker");
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    const result = await (stats.isFrozen ? unfreezeBroker() : freezeBroker());
    setPending(false);
    if (!result.success) {
      toast.error(t(stats.isFrozen ? "unfreezeFailed" : "freezeFailed"), result.formError);
      return;
    }
    setConfirming(false);
    toast.success(t(stats.isFrozen ? "unfrozen" : "frozen"));
    router.refresh();
  }

  const button =
    "rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {stats.isFrozen ? (
          <Badge tone="danger">{t("stateFrozen")}</Badge>
        ) : (
          <Badge tone="success">{t("stateRunning")}</Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {stats.isFrozen ? t("frozenExplain") : t("runningExplain")}
      </p>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {stats.entries.map(([name, value]) => (
              <tr key={name} className="border-b border-border last:border-0">
                <th scope="row" className="px-3 py-1.5 text-left font-medium">
                  {name}
                </th>
                <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} onClick={() => router.refresh()}>
          {t("refresh")}
        </button>
        <button
          type="button"
          className={stats.isFrozen ? button : `${button} text-destructive`}
          onClick={() => setConfirming(true)}
        >
          {stats.isFrozen ? t("unfreeze") : t("freeze")}
        </button>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => !open && setConfirming(false)}
        title={stats.isFrozen ? t("unfreeze") : t("freeze")}
        description={stats.isFrozen ? t("confirmUnfreeze") : t("confirmFreeze")}
        confirmLabel={stats.isFrozen ? t("unfreeze") : t("freeze")}
        destructive={!stats.isFrozen}
        pending={pending}
        onConfirm={() => void toggle()}
      />
    </div>
  );
}
