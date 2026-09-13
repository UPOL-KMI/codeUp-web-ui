"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";

import { setSolutionAccepted, setSolutionPoints } from "@/lib/actions/solution-verdict";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { useToast } from "@/components/toast/toast-provider";
import { buttonClasses } from "@/components/button";

/**
 * What a teacher decides about a solution that the pipeline did not (G-001): which attempt counts,
 * and what it is worth.
 *
 * **Three shortcuts and a form, which is the legacy screen's own shape.** Zeroing a solution,
 * awarding it full marks and clearing an override are the three things a teacher does most, and
 * each is one click; the form underneath is for the number in between. The shortcuts are not
 * separate endpoints -- all four submit the same `bonus-points` call -- but a teacher correcting a
 * broken test on twenty submissions should not type "0" twenty times.
 *
 * **Accepting is a move, not an addition**, so it confirms: core-api treats `accepted` as unique
 * per author per assignment and clears it from the author's other attempts. The dialog says that in
 * words, because the button does not look like it takes something away from another screen.
 *
 * Rendered only where core-api says so: `setFlag` and `setBonusPoints` are separate grants and the
 * two halves appear independently.
 */
export function VerdictControls({
  solutionId,
  accepted,
  overridden,
  bonus,
  maxPoints,
  canAccept,
  canSetPoints,
}: {
  solutionId: string;
  accepted: boolean;
  overridden: number | null;
  bonus: number;
  maxPoints: number;
  canAccept: boolean;
  canSetPoints: boolean;
}) {
  const t = useTranslations("Solution.verdict");
  const router = useRouter();
  const toast = useToast();
  const overrideId = useId();
  const bonusId = useId();

  const [pending, setPending] = useState(false);
  const [confirmingAccept, setConfirmingAccept] = useState(false);
  const [overrideInput, setOverrideInput] = useState(overridden === null ? "" : String(overridden));
  const [bonusInput, setBonusInput] = useState(String(bonus));

  if (!canAccept && !canSetPoints) return null;

  async function submitPoints(next: { overriddenPoints: number | null; bonusPoints: number }) {
    setPending(true);
    const result = await setSolutionPoints(solutionId, next);
    setPending(false);
    if (result.success) {
      setOverrideInput(next.overriddenPoints === null ? "" : String(next.overriddenPoints));
      setBonusInput(String(next.bonusPoints));
      toast.success(t("toast.pointsSaved"));
      router.refresh();
    } else {
      toast.error(t("errors.pointsFailed"), result.formError);
    }
  }

  async function accept(value: boolean) {
    setPending(true);
    const result = await setSolutionAccepted(solutionId, value);
    setPending(false);
    setConfirmingAccept(false);
    if (result.success) {
      toast.success(value ? t("toast.accepted") : t("toast.unaccepted"));
      router.refresh();
    } else {
      toast.error(t("errors.acceptFailed"), result.formError);
    }
  }

  const button =
    "rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-disabled:opacity-60";
  const input =
    "w-28 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <section aria-labelledby="solution-verdict" className="flex flex-col gap-3">
      <h2 id="solution-verdict" className="text-base font-semibold tracking-tight">
        {t("title")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("explain")}</p>

      {canAccept && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-disabled={pending}
            className={button}
            onClick={() => (accepted ? void accept(false) : setConfirmingAccept(true))}
          >
            {accepted ? t("unaccept") : t("accept")}
          </button>
          <span className="text-xs text-muted-foreground">
            {accepted ? t("acceptedNote") : t("acceptNote")}
          </span>
        </div>
      )}

      {canSetPoints && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-disabled={pending}
              className={button}
              onClick={() => void submitPoints({ overriddenPoints: 0, bonusPoints: 0 })}
            >
              {t("zero")}
            </button>
            <button
              type="button"
              aria-disabled={pending}
              className={button}
              onClick={() => void submitPoints({ overriddenPoints: maxPoints, bonusPoints: 0 })}
            >
              {t("full", { points: maxPoints })}
            </button>
            <button
              type="button"
              aria-disabled={pending || (overridden === null && bonus === 0)}
              className={button}
              onClick={() => void submitPoints({ overriddenPoints: null, bonusPoints: 0 })}
            >
              {t("clear")}
            </button>
          </div>

          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (pending) return;
              const trimmed = overrideInput.trim();
              void submitPoints({
                overriddenPoints: trimmed === "" ? null : Number(trimmed),
                bonusPoints: bonusInput.trim() === "" ? 0 : Number(bonusInput),
              });
            }}
          >
            <div className="flex flex-col gap-1 text-sm">
              <label htmlFor={overrideId} className="font-medium">
                {t("override")}
              </label>
              <input
                id={overrideId}
                type="number"
                step={1}
                inputMode="numeric"
                value={overrideInput}
                onChange={(event) => setOverrideInput(event.target.value)}
                placeholder={t("overridePlaceholder")}
                className={input}
              />
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <label htmlFor={bonusId} className="font-medium">
                {t("bonus")}
              </label>
              <input
                id={bonusId}
                type="number"
                step={1}
                inputMode="numeric"
                value={bonusInput}
                onChange={(event) => setBonusInput(event.target.value)}
                className={input}
              />
            </div>
            <button
              type="submit"
              aria-disabled={pending}
              className={buttonClasses("primary", "sm")}
            >
              {pending ? t("saving") : t("save")}
            </button>
          </form>
          <p className="text-xs text-muted-foreground">{t("overrideNote")}</p>
        </>
      )}

      <ConfirmDialog
        open={confirmingAccept}
        onOpenChange={(open) => !open && setConfirmingAccept(false)}
        title={t("confirmAccept.title")}
        description={t("confirmAccept.description")}
        pending={pending}
        onConfirm={() => void accept(true)}
        confirmLabel={t("confirmAccept.confirm")}
      />
    </section>
  );
}
