"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { lockStudentForExam, removeExamPeriod, setExamPeriod } from "@/lib/actions/group-exam";
import { DATE_TIME_SECONDS_FORMAT } from "@/lib/format/date-time";
import { phaseAt, type ExamLockType, type ExamPhase } from "@/lib/status/exam";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { ExamFormDialog } from "@/components/groups/exam-form";
import { useToast } from "@/components/toast/toast-provider";

/**
 * What the group's exam is doing right now, and every action that changes it (S-008).
 *
 * **The phase is the browser's answer, not the server's, and the two are reconciled rather than
 * papered over.** Whether an exam is running is a function of the current second; the server
 * decides it once, at render time, to choose what to fetch (the roster, the locks), and this
 * island keeps ticking afterwards. When its own answer stops matching what the server rendered, it
 * refreshes the route -- the same shape S-016 used for a running evaluation, and the reason the
 * legacy page runs a one-second interval too. The status text itself renders only after mount
 * (`useSyncExternalStore` with a `null` server snapshot), because a phase rendered on the server
 * and re-rendered a moment later in the browser is exactly the hydration mismatch AGENTS.md §6.6
 * is about.
 *
 * "Start now" appears only while the scheduled end is less than a day away, because core-api caps
 * an exam at 24 hours from its beginning: starting a distant exam now would be refused, so it is
 * not offered.
 */
const TICK_MS = 1000;

let clockSnapshot: number | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribeToClock(listener: () => void) {
  listeners.add(listener);
  timer ??= setInterval(() => {
    clockSnapshot = Math.floor(Date.now() / 1000);
    for (const notify of listeners) notify();
  }, TICK_MS);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

// Cached between ticks on purpose: `useSyncExternalStore` re-renders whenever `getSnapshot`
// returns a new value, so a snapshot that read the clock afresh on every call would never settle.
function readClock(): number {
  clockSnapshot ??= Math.floor(Date.now() / 1000);
  return clockSnapshot;
}

export function ExamStatus({
  groupId,
  begin,
  end,
  lockType,
  serverPhase,
  canSetPeriod,
  canRemovePeriod,
  viewerId,
  studiesHere,
  lockedHere,
  ipLock,
}: {
  groupId: string;
  begin: number | null;
  end: number | null;
  lockType: ExamLockType | null;
  /** The phase the server rendered this page for; a disagreement is what triggers a refresh. */
  serverPhase: ExamPhase;
  canSetPeriod: boolean;
  canRemovePeriod: boolean;
  /** The reader's own id -- core-api locks a named student, even when that student is the caller. */
  viewerId: string;
  studiesHere: boolean;
  lockedHere: boolean;
  ipLock: string | null;
}) {
  const t = useTranslations("Group.exams");
  const format = useFormatter();
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState<"start" | "terminate" | "cancel" | null>(null);

  const now = useSyncExternalStore(subscribeToClock, readClock, () => null);
  const phase = now === null ? null : phaseAt(now, begin, end);

  useEffect(() => {
    if (phase !== null && phase !== serverPhase) router.refresh();
  }, [phase, serverPhase, router]);

  async function run(
    call: () => Promise<{ success: boolean; formError?: string }>,
    successKey: string,
    errorKey: string,
  ) {
    setPending(true);
    const result = await call();
    setPending(false);
    setConfirming(null);
    if (result.success) {
      toast.success(t(successKey));
      router.refresh();
    } else {
      toast.error(t(errorKey), result.formError);
    }
  }

  const nowSeconds = () => Math.floor(Date.now() / 1000);
  const startNow = () =>
    run(
      () => setExamPeriod(groupId, { begin: nowSeconds(), end: end ?? 0, lockType }),
      "toast.started",
      "errors.setFailed",
    );
  const terminateNow = () =>
    run(
      () => setExamPeriod(groupId, { begin: null, end: nowSeconds(), lockType: null }),
      "toast.terminated",
      "errors.setFailed",
    );
  const cancel = () =>
    run(() => removeExamPeriod(groupId), "toast.cancelled", "errors.removeFailed");
  const lockMeIn = () =>
    run(() => lockStudentForExam(groupId, viewerId), "toast.locked", "errors.lockFailed");

  const dateTime = (unixSeconds: number) =>
    format.dateTime(new Date(unixSeconds * 1000), DATE_TIME_SECONDS_FORMAT);

  const tone =
    phase === "running"
      ? "border-destructive/40 bg-destructive/5"
      : phase === "scheduled"
        ? "border-warning/40 bg-warning/5"
        : "border-border bg-card";

  const secondary =
    "rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60";
  const primary =
    "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60";

  const endsWithinDay = end !== null && now !== null && end - now <= 86400;

  return (
    <section className={`flex flex-col gap-3 rounded-lg border p-4 ${tone}`}>
      <h3 className="text-base font-medium" role="status">
        {phase === null
          ? t("status.unknown")
          : phase === "running"
            ? t("status.running")
            : phase === "scheduled"
              ? t("status.scheduled")
              : t("status.none")}
      </h3>

      {begin !== null && end !== null && phase !== "none" && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="font-medium">{t("status.begins")}</dt>
          <dd className="tabular-nums">{dateTime(begin)}</dd>
          <dt className="font-medium">{t("status.ends")}</dt>
          <dd className="tabular-nums">{dateTime(end)}</dd>
          {lockType && !studiesHere && (
            <>
              <dt className="font-medium">{t("status.lockType")}</dt>
              <dd>{t(`lockTypes.${lockType}`)}</dd>
            </>
          )}
          {studiesHere && lockedHere && ipLock && (
            <>
              <dt className="font-medium">{t("status.ipLock")}</dt>
              <dd>
                <code className="text-xs">{ipLock}</code>
              </dd>
            </>
          )}
        </dl>
      )}

      {canSetPeriod && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            className={primary}
            onClick={() => setEditing(true)}
          >
            {phase === "none" ? t("actions.schedule") : t("actions.edit")}
          </button>

          {phase === "running" && (
            <button
              type="button"
              disabled={pending}
              className={secondary}
              onClick={() => setConfirming("terminate")}
            >
              {t("actions.terminate")}
            </button>
          )}

          {phase === "scheduled" && endsWithinDay && (
            <button
              type="button"
              disabled={pending}
              className={secondary}
              onClick={() => setConfirming("start")}
            >
              {t("actions.start")}
            </button>
          )}

          {phase === "scheduled" && canRemovePeriod && (
            <button
              type="button"
              disabled={pending}
              className={secondary}
              onClick={() => setConfirming("cancel")}
            >
              {t("actions.cancel")}
            </button>
          )}
        </div>
      )}

      {studiesHere && phase === "running" && (
        <div className="flex flex-col gap-2 border-t border-border/60 pt-3 text-sm">
          {lockedHere ? (
            <>
              <p className="font-medium">{t("student.locked")}</p>
              <p className="text-muted-foreground">
                {t("student.lockedInfo")} {lockType ? t(`student.lockInfo.${lockType}`) : ""}
              </p>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground">{t("student.lockPrompt")}</p>
              <button
                type="button"
                disabled={pending}
                className={`${primary} self-start`}
                onClick={lockMeIn}
              >
                {t("student.lockButton")}
              </button>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">{t("status.clockWarning")}</p>

      {canSetPeriod && (
        <ExamFormDialog
          groupId={groupId}
          open={editing}
          onOpenChange={setEditing}
          onSaved={() => {
            toast.success(t("toast.scheduled"));
            router.refresh();
          }}
          begin={begin}
          end={end}
          lockType={lockType}
          examRunning={phase === "running"}
        />
      )}

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={confirming ? t(`confirm.${confirming}.title`) : ""}
        description={confirming ? t(`confirm.${confirming}.description`) : ""}
        destructive={confirming !== "start"}
        pending={pending}
        onConfirm={() => {
          if (confirming === "start") void startNow();
          if (confirming === "terminate") void terminateNow();
          if (confirming === "cancel") void cancel();
        }}
      />
    </section>
  );
}
