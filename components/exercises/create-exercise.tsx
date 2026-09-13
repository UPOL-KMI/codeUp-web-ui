"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { createExercise } from "@/lib/actions/exercise";

import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/toast/toast-provider";
import { buttonClasses } from "@/components/button";

/**
 * Making a new exercise (T-008), from the catalog it will appear in.
 *
 * **It creates first and configures second**, exactly as assigning does (DEC-093): core-api's
 * `actionCreate` takes a group and nothing else, applies its defaults and names the exercise after
 * its author, so there is nothing a wizard could usefully collect beforehand. The reader lands on
 * the settings form with the exercise already real -- and a brand-new exercise is **broken by
 * definition** (it has no tests), which means nobody can assign it and no student can meet it in
 * the meantime.
 *
 * The group list is the reader's own teaching groups, which is core-api's condition for
 * `createExercise` restated (`group.isSupervisorOrAdmin`, `group.isNotArchived`) -- there is no
 * hint on the exercise to ask, because the exercise does not exist yet.
 */
export function CreateExercise({ groups }: { groups: { id: string; name: string }[] }) {
  const t = useTranslations("Exercises.create");
  const router = useRouter();
  const toast = useToast();
  const [groupId, setGroupId] = useState("");
  const [pending, setPending] = useState(false);

  if (groups.length === 0) return null;

  async function create() {
    setPending(true);
    const result = await createExercise(groupId);
    if (result.success) {
      router.push(`/exercises/${result.data.id}/edit`);
      return;
    }
    setPending(false);
    toast.error(t("failed"), result.formError);
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {t("group")}
        <select
          value={groupId}
          onChange={(event) => setGroupId(event.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">{t("choose")}</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={pending || groupId === ""}
        onClick={() => void create()}
        className={buttonClasses("primary", "sm")}
      >
        {pending ? t("creating") : t("action")}
      </button>
      <p className="w-full text-xs text-muted-foreground">{t("explain")}</p>
    </div>
  );
}
