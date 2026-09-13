"use client";

import { useState } from "react";
import { FormProvider } from "react-hook-form";
import { useFormatter, useTranslations } from "next-intl";

import { createLicence, deleteLicence } from "@/lib/actions/instances";
import {
  licenceFormSchema,
  licenceFormToValues,
  type LicenceFormValues,
} from "@/lib/actions/instances.schema";
import type { Licence } from "@/lib/api/instances";
import { DATE_ONLY_FORMAT } from "@/lib/format/date-time";
import { useServerActionForm } from "@/lib/forms/use-server-action-form";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { Field } from "@/components/form/field";
import { FormError } from "@/components/form/form-error";
import { Badge } from "@/components/status/badge";
import { useToast } from "@/components/toast/toast-provider";
import { buttonClasses } from "@/components/button";

/**
 * The licences an instance runs on (AD-008).
 *
 * **A licence stops counting for two different reasons, and the table says which.** It can expire,
 * or an administrator can revoke it. Expiry is a date, revocation is a switch, and each row shows
 * its own -- an instance with three licences and none of them counting is a sentence somebody has
 * to be able to read.
 *
 * **`hasValidLicence` is not "one of the rows below is valid".** core-api computes it as
 * `needsLicence === false || validLicences > 0` (read out of the `Instance` entity), and it does
 * **not publish `needsLicence`** -- so an instance that needs no licence reports `true` with an
 * empty table, which on its own reads as a contradiction. The two are told apart by inference,
 * which is sound in both directions: core-api says it is fine and nothing here could be the
 * reason, therefore it needs none. Found by rendering it against the seeded instance, which is
 * exactly that case.
 *
 * **The state column is read-only, and so is the legacy app's -- now for a known reason.** A
 * "revoke" button was built here first and then removed: core-api's `actionUpdateLicence` reads
 * the flag as `$req->getPost("isValid") ? ... : $licence->isValid()`, so `false` is falsy and
 * silently keeps the old value, while `"false"` and `0` fail its boolean validator. **A licence
 * can be set valid and never invalid, by any client** -- reproduced three ways with `curl` and
 * filed as Q-022. Deleting works and is offered, behind a confirmation, since a deployment whose
 * licence goes away stops working.
 *
 * A client component throughout because the dates are compared against *now*: rendering "expired"
 * on the server would freeze that judgement at render time and, worse, disagree with the reader's
 * own clock (AGENTS.md §6.6).
 */
export function LicenceManager({
  instanceId,
  licences,
  hasValidLicence,
}: {
  instanceId: string;
  licences: Licence[];
  /** core-api's own verdict, which is **not** the same as "one of the rows below is valid". */
  hasValidLicence: boolean;
}) {
  const t = useTranslations("Instances.licences");
  const tErrors = useTranslations("Instances.errors");
  const format = useFormatter();
  const router = useRouter();
  const toast = useToast();
  const [now] = useState(() => Math.floor(Date.now() / 1000));
  const [confirming, setConfirming] = useState<Licence | null>(null);
  const [pending, setPending] = useState(false);

  const { form, onSubmit, isPending } = useServerActionForm<LicenceFormValues, { id: string }>({
    schema: licenceFormSchema,
    defaultValues: { note: "", validUntil: "" },
    action: (values) => {
      const payload = licenceFormToValues(values);
      return payload === null
        ? Promise.resolve({ success: false as const, formError: tErrors("badDate") })
        : createLicence(instanceId, payload);
    },
    onSuccess: () => {
      form.reset();
      toast.success(t("added"));
      router.refresh();
    },
  });

  const {
    register,
    formState: { errors },
  } = form;

  async function remove() {
    if (!confirming) return;
    setPending(true);
    const result = await deleteLicence(confirming.id);
    setPending(false);
    if (!result.success) {
      toast.error(t("deleteFailed"), result.formError);
      return;
    }
    setConfirming(null);
    toast.success(t("deleted"));
    router.refresh();
  }

  const input =
    "rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring aria-invalid:border-destructive";
  const button =
    "rounded-md border border-input px-2 py-1 text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {!hasValidLicence
          ? t("summary.missing")
          : licences.some((licence) => licence.isValid && licence.validUntil > now)
            ? t("summary.covered")
            : t("summary.notNeeded")}
      </p>

      {licences.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {t("columns.note")}
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {t("columns.validUntil")}
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {t("columns.state")}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t("columns.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {licences.map((licence) => {
                const expired = licence.validUntil <= now;
                return (
                  <tr
                    key={licence.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-3 py-2">{licence.note}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      <time dateTime={new Date(licence.validUntil * 1000).toISOString()}>
                        {format.dateTime(new Date(licence.validUntil * 1000), DATE_ONLY_FORMAT)}
                      </time>
                    </td>
                    <td className="px-3 py-2">
                      {!licence.isValid ? (
                        <Badge tone="danger">{t("state.revoked")}</Badge>
                      ) : expired ? (
                        <Badge tone="warning">{t("state.expired")}</Badge>
                      ) : (
                        <Badge tone="success">{t("state.valid")}</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className={`${button} text-destructive`}
                        onClick={() => setConfirming(licence)}
                      >
                        {t("delete")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <FormProvider {...form}>
        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-3 rounded-lg border border-border p-3"
        >
          <FormError />
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t("note")} error={errors.note && t("errors.tooShort")}>
              <input
                type="text"
                aria-invalid={errors.note ? true : undefined}
                className={`${input} min-w-64`}
                {...register("note")}
              />
            </Field>
            <Field label={t("validUntil")} error={errors.validUntil && t("errors.required")}>
              <input
                type="datetime-local"
                aria-invalid={errors.validUntil ? true : undefined}
                className={input}
                {...register("validUntil")}
              />
            </Field>
            <button type="submit" disabled={isPending} className={buttonClasses("primary", "sm")}>
              {t("add")}
            </button>
          </div>
        </form>
      </FormProvider>

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(next) => !next && setConfirming(null)}
        title={t("delete")}
        description={t("confirmDelete")}
        confirmLabel={t("delete")}
        pending={pending}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
