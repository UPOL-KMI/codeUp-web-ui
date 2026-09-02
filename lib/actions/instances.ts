"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiDelete, apiPost } from "@/lib/api/client";
import { fromDateTimeLocal } from "@/lib/format/datetime-local";
import type { ActionResult } from "@/lib/forms/action-result";

import {
  createInstanceSchema,
  licenceSchema,
  type CreateInstanceValues,
  type LicenceValues,
} from "./instances.schema";

/**
 * Everything a superadmin does to an instance (AD-004, AD-005) and to its licences (AD-008).
 *
 * All of it is the superadmin's alone -- `permissions.neon` has no narrower grant for adding,
 * updating or removing an instance, and a supervisor is refused every call here (verified live).
 * Reading, by contrast, is public, which is why `lib/api/instances.ts` says so and this file does
 * not repeat it.
 *
 * No `revalidatePath` (DEC-021): every read is `no-store`, and the caller refreshes the router.
 */
async function failure(error: unknown, fallbackKey: string): Promise<ActionResult<never>> {
  const t = await getTranslations("Instances.errors");
  return {
    success: false,
    formError: error instanceof ApiError ? error.message : t(fallbackKey),
  };
}

/**
 * **Creating an instance creates a group too.** core-api builds the root group from the name and
 * description given here, and everything in the instance descends from it -- which is also why
 * those two fields never appear again: `POST /v1/instances/{id}` accepts only `isOpen`, and
 * renaming afterwards means editing that group.
 */
export async function createInstance(
  values: CreateInstanceValues,
): Promise<ActionResult<{ id: string }>> {
  const t = await getTranslations("Instances.errors");
  const parsed = createInstanceSchema.safeParse(values);
  if (!parsed.success) return { success: false, formError: t("invalid") };

  try {
    const created = await apiPost<{ id: string }>("/v1/instances", {
      name: parsed.data.name,
      isOpen: parsed.data.isOpen,
      ...(parsed.data.description !== "" && { description: parsed.data.description }),
    });
    return { success: true, data: { id: created.id } };
  } catch (error) {
    return failure(error, "createFailed");
  }
}

/** The only thing about an instance that this endpoint can change. */
export async function setInstanceOpen(
  instanceId: string,
  isOpen: boolean,
): Promise<ActionResult<{ isOpen: boolean }>> {
  try {
    await apiPost("/v1/instances/{id}", { isOpen }, { pathParams: { id: instanceId } });
    return { success: true, data: { isOpen } };
  } catch (error) {
    return failure(error, "updateFailed");
  }
}

/**
 * **Deleting an instance does not delete anything under it.** `actionDeleteInstance` removes the
 * instance row and stops -- the root group survives, orphaned, and goes on appearing in the group
 * list and in the sidebar of whoever administers it (Q-023, found by deleting one and watching
 * eight of them pile up). The confirmation says that, because the obvious reading -- that an
 * instance takes its world with it -- is wrong and would be a bad thing to be wrong about.
 *
 * This action deliberately does **not** delete the group as well. Removing a group tree is a far
 * larger destructive act than the endpoint being called promises, and doing it as an unannounced
 * second call could half-succeed; the screen points at the group instead, so whoever wants it gone
 * removes it where groups are removed.
 */
export async function deleteInstance(instanceId: string): Promise<ActionResult<{ id: string }>> {
  try {
    await apiDelete("/v1/instances/{id}", { pathParams: { id: instanceId } });
    return { success: true, data: { id: instanceId } };
  } catch (error) {
    return failure(error, "deleteFailed");
  }
}

/**
 * A new licence.
 *
 * **There is no "revoke" action here, and that is core-api's doing rather than an omission.**
 * `actionUpdateLicence` reads the flag as `$req->getPost("isValid") ? filter_var(...) :
 * $licence->isValid()` -- so `false` is falsy, takes the else branch, and keeps the old value,
 * while `"false"` and `0` are rejected outright by the boolean validator. A licence can therefore
 * be set valid and never invalid, through any client. Reproduced with `curl`, three ways (Q-022).
 * The legacy app shows the flag in a read-only column for exactly this reason; this app does too.
 *
 * **The expiry is unix seconds on create and a string on update** -- core-api's own two
 * signatures, not a mistake here (`validUntil: integer` on `createLicence`, `type: string` on
 * `updateLicence`, both read from the spec and confirmed live). Sending the number to the update
 * endpoint works because PHP casts it, but the difference is real and is why these two actions do
 * not share one body-builder.
 */
export async function createLicence(
  instanceId: string,
  values: LicenceValues,
): Promise<ActionResult<{ id: string }>> {
  const t = await getTranslations("Instances.errors");
  const parsed = licenceSchema.safeParse(values);
  if (!parsed.success) return { success: false, formError: t("invalid") };

  const validUntil = fromDateTimeLocal(parsed.data.validUntil);
  if (validUntil === null) return { success: false, formError: t("badDate") };

  try {
    const created = await apiPost<{ id: string }>(
      "/v1/instances/{id}/licences",
      { note: parsed.data.note, validUntil },
      { pathParams: { id: instanceId } },
    );
    return { success: true, data: { id: created.id } };
  } catch (error) {
    return failure(error, "licenceFailed");
  }
}

export async function deleteLicence(licenceId: string): Promise<ActionResult<{ id: string }>> {
  try {
    await apiDelete("/v1/instances/licences/{licenceId}", { pathParams: { licenceId } });
    return { success: true, data: { id: licenceId } };
  } catch (error) {
    return failure(error, "licenceDeleteFailed");
  }
}
