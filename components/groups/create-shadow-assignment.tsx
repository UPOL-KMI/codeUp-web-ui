"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { createShadowAssignment } from "@/lib/actions/shadow-assignment";

import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/toast/toast-provider";
import { buttonClasses } from "@/components/button";

/**
 * A new shadow assignment in this group (G-009).
 *
 * **No dialog, because there is nothing to ask.** core-api's `actionCreate` accepts a `groupId` and
 * nothing else -- it builds an empty shadow assignment and hands it back -- so a form here would
 * collect fields it could not send. One press, and the settings screen it lands on is where the
 * name, the points and the deadline are typed. DEC-093's shape for the third time, and this is the
 * one place it is not even a choice.
 *
 * core-api refuses an organizational group outright, and that refusal is forwarded rather than
 * pre-empted: it is the same rule F-029 records from the other side, and its own sentence says it
 * better than a disabled button would.
 */
export function CreateShadowAssignment({ groupId }: { groupId: string }) {
  const t = useTranslations("Group.assignments.shadow");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  async function create() {
    setPending(true);
    const result = await createShadowAssignment(groupId);
    setPending(false);
    if (result.success) {
      toast.success(t("created"));
      router.push(`/shadow-assignments/${result.data.shadowId}/edit`);
    } else {
      toast.error(t("createFailed"), result.formError);
    }
  }

  return (
    <div>
      <button
        type="button"
        aria-disabled={pending}
        className={buttonClasses("outline", "sm")}
        onClick={() => void create()}
      >
        {t("create")}
      </button>
    </div>
  );
}
