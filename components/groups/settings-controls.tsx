"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  deleteGroup,
  relocateGroup,
  setGroupArchived,
  setGroupExamFlag,
  setGroupOrganizational,
} from "@/lib/actions/group-settings";
import type { GroupDetail, GroupRef } from "@/lib/api/group-detail";
import type { ActionResult } from "@/lib/forms/action-result";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { useToast } from "@/components/toast/toast-provider";

/**
 * Everything about a group that is a decision rather than a field (S-009): what kind of group it
 * is, whether it is archived, where it hangs in the hierarchy, and whether it exists at all.
 *
 * Each control is offered strictly on core-api's own hint, and each states what it does before it
 * does it -- these are the actions on this screen that other people notice. Archiving and deletion
 * confirm; the two type flags do not, because both are one call away from being undone and the
 * legacy app treats them the same way.
 *
 * The two type flags are mutually exclusive by core-api's rule (`checkSetOrganizational`: an
 * organizational group must not be an exam group), so each is hidden while the other holds --
 * exactly as the legacy screen hides them.
 */
export function GroupSettingsControls({
  group,
  relocationTargets,
}: {
  group: GroupDetail;
  relocationTargets: GroupRef[];
}) {
  const t = useTranslations("Group.settings.controls");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState<"archive" | "unarchive" | "delete" | null>(null);
  const [newParent, setNewParent] = useState(group.parentGroupId ?? "");

  async function run(
    call: () => Promise<ActionResult<unknown>>,
    successKey: string,
    { navigateTo }: { navigateTo?: string } = {},
  ) {
    setPending(true);
    const result = await call();
    setPending(false);
    setConfirming(null);
    if (result.success) {
      toast.success(t(successKey));
      if (navigateTo) router.push(navigateTo);
      else router.refresh();
    } else {
      toast.error(t("failed"), result.formError);
    }
  }

  const button =
    "rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60";
  const destructive =
    "rounded-md border border-destructive/50 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60";

  const canChangeType =
    !group.archived && (group.can.setOrganizational === true || group.can.setExamFlag === true);
  const canArchive = group.can.archive === true && (!group.archived || group.directlyArchived);
  const canRelocate =
    group.can.relocate === true && !group.archived && relocationTargets.length > 0;
  // A group with subgroups cannot be removed, and neither can an instance's root -- the legacy
  // button disables itself on both, and core-api refuses both regardless.
  const canDelete =
    group.can.remove === true && group.parentGroupId !== null && group.subgroups.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {canChangeType && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t("type.title")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("type.current", {
              type: group.exam
                ? t("type.exam")
                : group.organizational
                  ? t("type.organizational")
                  : t("type.regular"),
            })}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.can.setOrganizational === true && !group.exam && (
              <button
                type="button"
                disabled={pending}
                className={button}
                onClick={() =>
                  void run(
                    () => setGroupOrganizational(group.id, !group.organizational),
                    "type.changed",
                  )
                }
              >
                {group.organizational ? t("type.makeRegular") : t("type.makeOrganizational")}
              </button>
            )}
            {group.can.setExamFlag === true && !group.organizational && (
              <button
                type="button"
                disabled={pending}
                className={button}
                onClick={() =>
                  void run(() => setGroupExamFlag(group.id, !group.exam), "type.changed")
                }
              >
                {group.exam ? t("type.unmarkExam") : t("type.markExam")}
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t("type.explain")}</p>
        </section>
      )}

      {canArchive && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t("archive.title")}</h3>
          <p className="text-xs text-muted-foreground">{t("archive.explain")}</p>
          <div>
            <button
              type="button"
              disabled={pending}
              className={button}
              onClick={() => setConfirming(group.archived ? "unarchive" : "archive")}
            >
              {group.archived ? t("archive.unarchive") : t("archive.archive")}
            </button>
          </div>
        </section>
      )}

      {canRelocate && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t("relocate.title")}</h3>
          <p className="text-xs text-muted-foreground">{t("relocate.explain")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label={t("relocate.newParent")}
              value={newParent}
              onChange={(event) => setNewParent(event.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">{t("relocate.choose")}</option>
              {relocationTargets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={pending || !newParent || newParent === group.parentGroupId}
              className={button}
              onClick={() => void run(() => relocateGroup(group.id, newParent), "relocate.done")}
            >
              {t("relocate.move")}
            </button>
          </div>
        </section>
      )}

      {canDelete && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-destructive">{t("delete.title")}</h3>
          <p className="text-xs text-muted-foreground">{t("delete.explain")}</p>
          <div>
            <button
              type="button"
              disabled={pending}
              className={destructive}
              onClick={() => setConfirming("delete")}
            >
              {t("delete.button")}
            </button>
          </div>
        </section>
      )}

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={confirming ? t(`confirm.${confirming}.title`) : ""}
        description={confirming ? t(`confirm.${confirming}.description`) : ""}
        pending={pending}
        onConfirm={() => {
          if (confirming === "archive")
            void run(() => setGroupArchived(group.id, true), "archive.archived");
          if (confirming === "unarchive")
            void run(() => setGroupArchived(group.id, false), "archive.unarchived");
          if (confirming === "delete")
            void run(() => deleteGroup(group.id), "delete.done", {
              navigateTo: group.parentGroupId ? `/groups/${group.parentGroupId}` : "/groups",
            });
        }}
      />
    </div>
  );
}
