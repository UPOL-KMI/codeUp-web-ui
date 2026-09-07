"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { setReviewRequested } from "@/lib/actions/solution-review";

import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/toast/toast-provider";

/**
 * Asking a teacher to look at this solution, and taking the question back (G-003).
 *
 * **The other end of this was built long before the control was.** S-002 put a "reviews students
 * have asked for" queue on the teacher's dashboard, and `reviewRequested` is read in four places
 * across this app -- and until now nothing anywhere could set it, so the queue was permanently
 * empty by construction.
 *
 * Offered on `setFlagAsStudent` *or* `setFlag`, which is core-api's own weaker test for this flag:
 * the author may ask, and so may a supervisor on their behalf.
 *
 * **Gone once a review exists.** Asking for something already happening is noise, and withdrawing a
 * request after the teacher has started reading would not stop them -- core-api keeps the flag and
 * the review independently, so the honest thing is to stop offering it rather than to imply it
 * still means something.
 */
export function ReviewRequest({
  solutionId,
  requested,
  canRequest,
  reviewStarted,
}: {
  solutionId: string;
  requested: boolean;
  canRequest: boolean;
  reviewStarted: boolean;
}) {
  const t = useTranslations("Review.request");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  if (!canRequest || reviewStarted) return null;

  async function change(value: boolean) {
    setPending(true);
    const result = await setReviewRequested(solutionId, value);
    setPending(false);
    if (result.success) {
      toast.success(value ? t("toast.asked") : t("toast.withdrawn"));
      router.refresh();
    } else {
      toast.error(t("errors.failed"), result.formError);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-disabled={pending}
        className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-disabled:opacity-60"
        onClick={() => void change(!requested)}
      >
        {requested ? t("withdraw") : t("ask")}
      </button>
      <span className="text-xs text-muted-foreground">
        {requested ? t("askedNote") : t("askNote")}
      </span>
    </div>
  );
}
