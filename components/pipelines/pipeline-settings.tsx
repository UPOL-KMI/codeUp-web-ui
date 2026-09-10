"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  deletePipeline,
  forkPipeline,
  updatePipelineEnvironments,
  updatePipelineSettings,
} from "@/lib/actions/pipeline";
import { PIPELINE_PARAMETERS } from "@/lib/actions/pipeline.schema";
import type { ActionResult } from "@/lib/forms/action-result";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { useToast } from "@/components/toast/toast-provider";

/**
 * A pipeline's own settings, and the three things that are not settings (T-015).
 *
 * **The parameters are the load-bearing field on this screen.** They are not description: T-009's
 * configuration editor reads them to decide where each variable of an exercise goes and which
 * fields a test offers, and `relevantPipelines()` picks between two execution pipelines purely on
 * `producesStdout` against `producesFiles`. Getting one wrong does not break this pipeline -- it
 * quietly changes what every exercise configured against it writes.
 *
 * **Deleting says what it costs and core-api decides.** A pipeline used by an exercise cannot be
 * removed; rather than guessing that rule here, the button is offered on the `remove` hint and
 * core-api's refusal is shown in its own words. The detail screen lists the exercises, which is
 * where somebody checks first.
 *
 * Forking is the safe way to change shared machinery: a copy, edited freely, and the original left
 * alone for the exercises already built on it.
 */
export function PipelineSettings({
  pipelineId,
  version,
  name,
  description,
  parameters,
  environments,
  selectedEnvironments,
  can,
}: {
  pipelineId: string;
  version: number;
  name: string;
  description: string;
  parameters: Record<string, boolean>;
  environments: { id: string; name: string }[];
  selectedEnvironments: string[];
  can: Record<string, boolean>;
}) {
  const t = useTranslations("PipelineEdit.settings");
  const router = useRouter();
  const toast = useToast();

  const [values, setValues] = useState({ name, description, parameters });
  const [chosen, setChosen] = useState<string[]>(selectedEnvironments);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const readOnly = can.update !== true;

  async function run(call: () => Promise<ActionResult<unknown>>, successKey: string) {
    setPending(true);
    setError(null);
    const result = await call();
    setPending(false);
    if (!result.success) {
      setError(result.formError ?? t("saveFailed"));
      return null;
    }
    toast.success(t(successKey));
    router.refresh();
    return result.data;
  }

  const input =
    "rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm sm:max-w-lg">
          {t("name")}
          <input
            type="text"
            className={input}
            disabled={readOnly}
            value={values.name}
            onChange={(event) =>
              setValues((previous) => ({ ...previous, name: event.target.value }))
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("description")}
          <textarea
            rows={5}
            className={`${input} font-mono`}
            disabled={readOnly}
            value={values.description}
            onChange={(event) =>
              setValues((previous) => ({ ...previous, description: event.target.value }))
            }
          />
          <span className="text-xs text-muted-foreground">{t("descriptionHint")}</span>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{t("parameters")}</legend>
          <p className="text-xs text-muted-foreground">{t("parametersExplain")}</p>
          <ul className="grid gap-1 sm:grid-cols-2">
            {PIPELINE_PARAMETERS.map((parameter) => (
              <li key={parameter}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    disabled={readOnly}
                    checked={values.parameters[parameter] === true}
                    onChange={(event) =>
                      setValues((previous) => ({
                        ...previous,
                        parameters: { ...previous.parameters, [parameter]: event.target.checked },
                      }))
                    }
                  />
                  {t(`parameterNames.${parameter}`)}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        {!readOnly && (
          <div>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                void run(() => updatePipelineSettings(pipelineId, { version, ...values }), "saved")
              }
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {pending ? t("saving") : t("save")}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{t("environments")}</h3>
        <p className="text-xs text-muted-foreground">{t("environmentsExplain")}</p>
        <ul className="grid gap-1 sm:grid-cols-3">
          {environments.map((environment) => (
            <li key={environment.id}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={can.updateEnvironments !== true}
                  checked={chosen.includes(environment.id)}
                  onChange={(event) =>
                    setChosen((previous) =>
                      event.target.checked
                        ? [...previous, environment.id]
                        : previous.filter((id) => id !== environment.id),
                    )
                  }
                />
                {environment.name}
              </label>
            </li>
          ))}
        </ul>
        {can.updateEnvironments === true && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              void run(() => updatePipelineEnvironments(pipelineId, chosen), "environmentsSaved")
            }
            className="self-start rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60"
          >
            {t("saveEnvironments")}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {can.fork === true && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              void run(() => forkPipeline(pipelineId), "forked").then((data) => {
                const forked = data as { id: string } | null;
                if (forked) router.push(`/pipelines/${forked.id}/edit`);
              });
            }}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60"
          >
            {t("fork")}
          </button>
        )}
        {can.remove === true && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmingDelete(true)}
            className="rounded-md border border-destructive px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60"
          >
            {t("delete")}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={t("confirmDelete.title")}
        description={t("confirmDelete.description")}
        confirmLabel={t("confirmDelete.confirm")}
        pending={pending}
        onConfirm={() => {
          setConfirmingDelete(false);
          void run(() => deletePipeline(pipelineId), "deleted").then((data) => {
            if (data) router.push("/pipelines");
          });
        }}
      />
    </div>
  );
}
