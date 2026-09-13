"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { createPipeline } from "@/lib/actions/pipeline";

import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/toast/toast-provider";
import { buttonClasses } from "@/components/button";

/**
 * Making a new pipeline (G-016).
 *
 * `createPipeline()` shipped with T-013's action module and **nothing ever called it**, so the
 * only route to a new pipeline was forking an existing one -- which works everywhere except the
 * instance that has none, the one place a new pipeline is actually needed.
 *
 * **The pipeline it makes is empty and real**, the shape T-008's exercise creation and T-001's
 * assigning both use (DEC-093): core-api names it "Pipeline by <author>", gives it no boxes, and
 * this lands the reader on its structure editor. There is no wizard to abandon halfway, and an
 * empty pipeline no exercise references harms nobody.
 *
 * **Not offered as global.** core-api's endpoint takes a `global` flag -- a pipeline with no
 * author, for the generic runtimes -- and this deliberately does not, because the legacy app's own
 * button does not either: a global pipeline is part of a runtime package, imported rather than
 * drawn by hand, and a flag that cannot be changed afterwards is the wrong thing to put behind an
 * unlabelled click.
 */
export function CreatePipeline() {
  const t = useTranslations("Pipelines");
  // The failure message is the one T-013's action already names, rather than a second copy of the
  // same sentence under this screen's own namespace.
  const tError = useTranslations("PipelineEdit.errors");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  async function create() {
    setPending(true);
    const result = await createPipeline();
    if (!result.success) {
      setPending(false);
      toast.error(tError("createFailed"), result.formError);
      return;
    }
    router.push(`/pipelines/${result.data.id}/edit`);
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void create()}
      className={buttonClasses("primary", "sm")}
    >
      {pending ? t("creating") : t("create")}
    </button>
  );
}
