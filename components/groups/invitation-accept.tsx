"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { acceptGroupInvitation } from "@/lib/actions/group-invitation";

import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/toast/toast-provider";
import { buttonClasses } from "@/components/button";

/**
 * The one action this screen has (S-023). A button, not a form: there is nothing to fill in.
 *
 * On success it goes to the group's assignments -- the same destination the legacy page picks, and
 * the only one that answers the question the reader actually had, which is what is waiting for
 * them in the group they just joined.
 */
export function InvitationAccept({ invitationId }: { invitationId: string }) {
  const t = useTranslations("GroupInvitation");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setPending(true);
    setError(null);
    const result = await acceptGroupInvitation(invitationId);
    if (result.success) {
      toast.success(t("joined"));
      router.replace(`/groups/${result.data.groupId}?tab=assignments`);
      return;
    }
    setPending(false);
    setError(result.formError ?? t("errors.acceptFailed"));
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <button
          type="button"
          disabled={pending}
          onClick={() => void accept()}
          className={buttonClasses("primary", "sm")}
        >
          {pending ? t("joining") : t("accept")}
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
