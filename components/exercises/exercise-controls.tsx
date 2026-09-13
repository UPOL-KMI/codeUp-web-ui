"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  addExerciseTag,
  attachExerciseGroup,
  deleteExercise,
  detachExerciseGroup,
  removeExerciseTag,
  sendExerciseNotification,
  setExerciseArchived,
} from "@/lib/actions/exercise";
import type { ExerciseDetail } from "@/lib/api/exercise-detail";
import type { ActionResult } from "@/lib/forms/action-result";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { Badge } from "@/components/status/badge";
import { useToast } from "@/components/toast/toast-provider";
import { buttonClasses } from "@/components/button";

/**
 * The parts of an exercise that are not a form field (T-008): its tags, the groups it lives in,
 * whether it is archived, and its deletion.
 *
 * Each of these is its own core-api call rather than a field of the settings save, which is why
 * they are here and not in `ExerciseForm`: a tag is added by `POST .../tags/{name}` and takes
 * effect immediately, with no version to carry and nothing to undo by reloading.
 *
 * **Attaching and detaching a group have no permission hint** -- core-api's rules are written
 * against the exercise *and* the group (`group.isSupervisorOrAdmin` on top of the exercise's own
 * conditions), so no hint computed for the exercise alone can express them (DEC-090's shape, for
 * the fourth time). The offer is therefore built from the groups the reader teaches, and core-api
 * decides for real. Detaching the **last** group is refused by core-api
 * (`exercise.hasAtLeastTwoAttachedGroups`) and so is not offered either: an exercise has to live
 * somewhere.
 *
 * Deleting confirms, and says what it does not do: the assignments already made from an exercise
 * survive it -- they are snapshots -- but they can never be synchronised with it again.
 */
export function ExerciseControls({
  exercise,
  teachingGroups,
  sections,
}: {
  exercise: ExerciseDetail;
  teachingGroups: { id: string; name: string }[];
  /** Which sections to render. The settings screen puts each on its own tab (T-033), and they are
   *  independent calls rather than one form, so splitting them costs nothing but saying which. */
  sections: ("tags" | "groups" | "notify" | "lifecycle")[];
}) {
  const shows = (section: "tags" | "groups" | "notify" | "lifecycle") => sections.includes(section);
  const t = useTranslations("ExerciseEdit");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [tag, setTag] = useState("");
  const [group, setGroup] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirmingNotice, setConfirmingNotice] = useState(false);

  async function run(call: () => Promise<ActionResult<unknown>>, successKey: string) {
    setPending(true);
    const result = await call();
    setPending(false);
    if (!result.success) {
      toast.error(t("errors.failed"), result.formError);
      return false;
    }
    toast.success(t(successKey));
    router.refresh();
    return true;
  }

  // An archived exercise is frozen: core-api's `attachGroup`/`detachGroup` rules both require
  // `exercise.notArchived`, so neither is offered for one -- restoring it is the way back.
  const frozen = exercise.archivedAt !== null;
  const attachable = frozen
    ? []
    : teachingGroups.filter(
        (candidate) => !exercise.groups.some((attached) => attached.id === candidate.id),
      );
  // core-api refuses to detach the last group, so the control is absent rather than refused.
  const canDetach = !frozen && exercise.groups.length + exercise.undisclosedGroups > 1;

  return (
    <div className="flex flex-col gap-8">
      {shows("tags") && (
        <section aria-labelledby="exercise-tags" className="flex flex-col gap-2">
          <h2 id="exercise-tags" className="text-base font-semibold tracking-tight">
            {t("tags.title")}
          </h2>
          <p className="text-xs text-muted-foreground">{t("tags.explain")}</p>
          <div className="flex flex-wrap items-center gap-2">
            {exercise.tags.length === 0 && (
              <span className="text-sm text-muted-foreground">{t("tags.none")}</span>
            )}
            {exercise.tags.map((name) => (
              <span key={name} className="flex items-center gap-1">
                <Badge>{name}</Badge>
                {exercise.can.removeTag === true && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      void run(() => removeExerciseTag(exercise.id, name), "tags.removed")
                    }
                    aria-label={t("tags.remove", { tag: name })}
                    className="rounded-md px-1 text-xs text-muted-foreground hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
          {exercise.can.addTag === true && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-sm">
                {t("tags.add")}
                <input
                  type="text"
                  value={tag}
                  onChange={(event) => setTag(event.target.value)}
                  maxLength={32}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <button
                type="button"
                disabled={pending || tag.trim() === ""}
                onClick={() =>
                  void run(() => addExerciseTag(exercise.id, tag), "tags.added").then((ok) => {
                    if (ok) setTag("");
                  })
                }
                className={buttonClasses("outline", "sm")}
              >
                {t("tags.addAction")}
              </button>
            </div>
          )}
        </section>
      )}

      {shows("groups") && (
        <section aria-labelledby="exercise-groups" className="flex flex-col gap-2">
          <h2 id="exercise-groups" className="text-base font-semibold tracking-tight">
            {t("groups.title")}
          </h2>
          <p className="text-xs text-muted-foreground">{t("groups.explain")}</p>
          <ul className="flex flex-col gap-2 text-sm">
            {exercise.groups.map((attached) => (
              <li
                key={attached.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <span>{attached.name}</span>
                {canDetach && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      void run(
                        () => detachExerciseGroup(exercise.id, attached.id),
                        "groups.detached",
                      )
                    }
                    className={buttonClasses("outline", "xs")}
                  >
                    {t("groups.detach")}
                  </button>
                )}
              </li>
            ))}
            {exercise.undisclosedGroups > 0 && (
              <li className="text-xs text-muted-foreground">
                {t("groups.undisclosed", { count: exercise.undisclosedGroups })}
              </li>
            )}
          </ul>
          {attachable.length > 0 && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-sm">
                {t("groups.attach")}
                <select
                  value={group}
                  onChange={(event) => setGroup(event.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">{t("groups.choose")}</option>
                  {attachable.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={pending || group === ""}
                onClick={() =>
                  void run(() => attachExerciseGroup(exercise.id, group), "groups.attached").then(
                    (ok) => {
                      if (ok) setGroup("");
                    },
                  )
                }
                className={buttonClasses("outline", "sm")}
              >
                {t("groups.attachAction")}
              </button>
            </div>
          )}
        </section>
      )}

      {/* G-019. The legacy button's own gate: `update` and not archived -- an archived exercise
          has nothing to announce, and core-api's rule requires the same. Nothing here can be
          verified end to end on this deployment, which has no outbound SMTP (Q-007). */}
      {shows("notify") && exercise.can.update === true && !frozen && (
        <section aria-labelledby="exercise-notify" className="flex flex-col gap-2">
          <h2 id="exercise-notify" className="text-base font-semibold tracking-tight">
            {t("notify.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("notify.explain")}</p>
          <label className="flex flex-col gap-1 text-sm">
            {t("notify.message")}
            <textarea
              value={notice}
              onChange={(event) => setNotice(event.target.value)}
              rows={3}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <p className="text-xs text-muted-foreground">{t("notify.messageHint")}</p>
          <div>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmingNotice(true)}
              className={buttonClasses("outline", "sm")}
            >
              {t("notify.action")}
            </button>
          </div>

          <ConfirmDialog
            open={confirmingNotice}
            onOpenChange={(open) => !open && setConfirmingNotice(false)}
            title={t("notify.confirm.title")}
            description={t("notify.confirm.description")}
            confirmLabel={t("notify.action")}
            destructive={false}
            pending={pending}
            onConfirm={() => {
              setPending(true);
              void sendExerciseNotification(exercise.id, notice).then((result) => {
                setPending(false);
                setConfirmingNotice(false);
                if (!result.success) {
                  toast.error(t("errors.failed"), result.formError);
                  return;
                }
                setNotice("");
                // Zero is core-api's honest answer, not a failure: a teacher can turn these
                // notifications off in their own settings, so "nobody was written to" needs
                // saying rather than reporting as a success with no effect.
                if (result.data.notified === 0) {
                  toast.success(t("notify.noRecipients"), t("notify.noRecipientsHint"));
                  return;
                }
                toast.success(t("notify.sent", { count: result.data.notified }));
              });
            }}
          />
        </section>
      )}

      {shows("lifecycle") && exercise.can.archive === true && (
        <section aria-labelledby="exercise-archive" className="flex flex-col gap-2">
          <h2 id="exercise-archive" className="text-base font-semibold tracking-tight">
            {t("archive.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("archive.explain")}</p>
          <div>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                void run(
                  () => setExerciseArchived(exercise.id, exercise.archivedAt === null),
                  exercise.archivedAt === null ? "archive.archived" : "archive.restored",
                )
              }
              className={buttonClasses("outline", "sm")}
            >
              {exercise.archivedAt === null ? t("archive.action") : t("archive.restore")}
            </button>
          </div>
        </section>
      )}

      {shows("lifecycle") && exercise.can.remove === true && (
        <section aria-labelledby="exercise-delete" className="flex flex-col gap-2">
          <h2 id="exercise-delete" className="text-base font-semibold tracking-tight">
            {t("delete.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("delete.explain")}</p>
          <div>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmingDelete(true)}
              className="rounded-md border border-destructive/50 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
            >
              {t("delete.action")}
            </button>
          </div>

          <ConfirmDialog
            open={confirmingDelete}
            onOpenChange={(open) => !open && setConfirmingDelete(false)}
            title={t("delete.confirm.title")}
            description={t("delete.confirm.description")}
            confirmLabel={t("delete.action")}
            pending={pending}
            onConfirm={() => {
              setPending(true);
              void deleteExercise(exercise.id).then((result) => {
                setPending(false);
                setConfirmingDelete(false);
                if (!result.success) {
                  toast.error(t("errors.failed"), result.formError);
                  return;
                }
                toast.success(t("delete.deleted"));
                router.push("/exercises");
              });
            }}
          />
        </section>
      )}
    </div>
  );
}
