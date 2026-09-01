"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { syncAssignmentWithExercise } from "@/lib/actions/assignment";

import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/toast/toast-provider";

/**
 * The button S-013's stale-exercise notice had been missing (T-002).
 *
 * Everything at once, not a selection of parts: core-api accepts a list, and offering one would
 * ask a teacher to choose between "score config" and "exercise config". The notice beside this
 * already names what has drifted; the answer to all of it is the same button.
 */
export function SyncWithExercise({ assignmentId }: { assignmentId: string }) {
  const t = useTranslations("Assignment.sync");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  async function run() {
    setPending(true);
    const result = await syncAssignmentWithExercise(assignmentId);
    setPending(false);
    if (result.success) {
      toast.success(t("synced"));
      router.refresh();
    } else {
      toast.error(t("syncFailed"), result.formError);
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void run()}
      className="mt-3 rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
    >
      {pending ? t("syncing") : t("sync")}
    </button>
  );
}
