"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiPost } from "@/lib/api/client";
import type { ActionResult } from "@/lib/forms/action-result";

import { resolveFailureSchema, type ResolveFailureValues } from "./submission-failure.schema";

/**
 * Marking a submission failure as dealt with (T-019).
 *
 * **There is no way back.** core-api has no un-resolve call -- `actionResolve` stamps the time and
 * the note and that is that -- which is why the dialog that calls this says so and asks twice in
 * effect (the note is typed, then submitted) rather than resolving on a single click.
 *
 * `sendEmail` mails the author of the submission that their failure was looked at. It is offered
 * because the legacy screen offers it and because a student whose solution vanished into an
 * infrastructure error is exactly the person who should hear back; it defaults to off here, since
 * an email is the irreversible half of an already irreversible action.
 *
 * core-api's `canResolve` decides on the call. No `revalidatePath` (DEC-021): every read is
 * `no-store`, and the caller refreshes the router.
 */
export async function resolveSubmissionFailure(
  failureId: string,
  values: ResolveFailureValues,
): Promise<ActionResult<{ id: string }>> {
  const t = await getTranslations("SubmissionFailures.errors");
  const parsed = resolveFailureSchema.safeParse(values);
  if (!parsed.success) return { success: false, formError: t("invalid") };

  try {
    await apiPost(
      "/v1/submission-failures/{id}/resolve",
      { note: parsed.data.note, sendEmail: parsed.data.sendEmail },
      { pathParams: { id: failureId } },
    );
    return { success: true, data: { id: failureId } };
  } catch (error) {
    return {
      success: false,
      formError: error instanceof ApiError ? error.message : t("resolveFailed"),
    };
  }
}
