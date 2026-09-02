"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { updateExerciseHardwareGroups } from "@/lib/actions/exercise-limits";
import type { HardwareGroup } from "@/lib/exercise-config/limits";

import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/toast/toast-provider";

/**
 * Which machines an exercise is meant to run on (T-010).
 *
 * A hardware group is the instance's description of a class of worker -- how much memory it has,
 * how long it will let one test run -- and an exercise with none of them cannot be assigned at
 * all: it is core-api's `@no-hwgroups`, the last of the four reasons a freshly created exercise
 * reports. Most instances have exactly one, and this deployment does, which is why the control is
 * a plain checkbox list rather than anything cleverer.
 *
 * **Changing the list rewrites the limits.** core-api's `hwGroupsUpdated` adds a branch for a
 * group that was added and drops the limits of one that was removed, so this saves on its own and
 * the page is re-read afterwards. Clearing it is allowed, because core-api allows it -- and the
 * exercise then says why it is broken, which is a better answer than a control that refuses.
 */
export function HardwareGroupsForm({
  exerciseId,
  available,
  selected,
  readOnly,
}: {
  exerciseId: string;
  available: HardwareGroup[];
  selected: string[];
  readOnly: boolean;
}) {
  const t = useTranslations("ExerciseLimits.hardwareGroups");
  const router = useRouter();
  const toast = useToast();
  const [chosen, setChosen] = useState<string[]>(selected);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setPending(true);
    const result = await updateExerciseHardwareGroups(exerciseId, { hardwareGroups: chosen });
    setPending(false);
    if (!result.success) {
      setError(result.formError ?? t("saveFailed"));
      return;
    }
    toast.success(t("saved"));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="grid gap-2 sm:grid-cols-2">
        {available.map((group) => (
          <li key={group.id}>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                disabled={readOnly}
                checked={chosen.includes(group.id)}
                onChange={(event) =>
                  setChosen((previous) =>
                    event.target.checked
                      ? [...previous, group.id]
                      : previous.filter((id) => id !== group.id),
                  )
                }
              />
              <span>
                <span className="font-medium">{group.name}</span>
                <span className="block text-xs text-muted-foreground">{group.description}</span>
                <span className="block text-xs text-muted-foreground">
                  {t("ceilings", {
                    memory: group.metadata.memory ?? 0,
                    cpu: group.metadata.cpuTimePerTest ?? 0,
                    wall: group.metadata.wallTimePerTest ?? 0,
                  })}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      {chosen.length === 0 && <p className="text-sm text-warning">{t("noneSelected")}</p>}

      {!readOnly && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => void save()}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {pending ? t("saving") : t("save")}
          </button>
          <p className="text-xs text-muted-foreground">{t("saveWarning")}</p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
