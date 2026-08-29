"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiDelete, apiPost } from "@/lib/api/client";
import type { ActionResult } from "@/lib/forms/action-result";

import {
  passwordSchema,
  profileSchema,
  settingsSchema,
  type PasswordValues,
  type ProfileValues,
  type SettingsValues,
} from "./account.schema";

/**
 * Changing one's own account (S-022): name and email, password, notification settings, and the
 * iCal tokens that let a calendar read one's deadlines.
 *
 * core-api decides who may do any of it (`canUpdateProfile`, `canEditCalendars`) on every call;
 * this app offers the screen to the account's owner. No `revalidatePath` (DEC-021).
 */
async function failure(error: unknown, fallbackKey: string): Promise<ActionResult<never>> {
  const t = await getTranslations("Account.errors");
  return {
    success: false,
    formError: error instanceof ApiError ? error.message : t(fallbackKey),
  };
}

export async function updateProfile(
  userId: string,
  values: ProfileValues,
): Promise<ActionResult<{ userId: string }>> {
  const t = await getTranslations("Account.errors");
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { success: false, formError: t("invalid") };

  try {
    await apiPost("/v1/users/{id}", parsed.data, { pathParams: { id: userId } });
    return { success: true, data: { userId } };
  } catch (error) {
    return failure(error, "profileFailed");
  }
}

/**
 * A successful password change **invalidates every token this user holds** -- core-api sets a
 * token validity threshold (`changeUserPassword`), so the session that made this request is dead
 * the moment it returns. The caller signs out rather than leaving the reader on a page whose next
 * click would 401.
 */
export async function changePassword(
  userId: string,
  values: PasswordValues,
): Promise<ActionResult<{ userId: string }>> {
  const t = await getTranslations("Account.errors");
  const parsed = passwordSchema.safeParse(values);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      success: false,
      formError: t(issue?.message === "mismatch" ? "passwordMismatch" : "invalid"),
    };
  }

  try {
    await apiPost(
      "/v1/users/{id}",
      {
        ...(parsed.data.oldPassword !== "" && { oldPassword: parsed.data.oldPassword }),
        password: parsed.data.password,
        passwordConfirm: parsed.data.passwordConfirm,
      },
      { pathParams: { id: userId } },
    );
    return { success: true, data: { userId } };
  } catch (error) {
    return failure(error, "passwordFailed");
  }
}

export async function updateSettings(
  userId: string,
  values: SettingsValues,
): Promise<ActionResult<{ userId: string }>> {
  const t = await getTranslations("Account.errors");
  const parsed = settingsSchema.safeParse(values);
  if (!parsed.success) return { success: false, formError: t("invalid") };

  try {
    await apiPost(
      "/v1/users/{id}/settings",
      { defaultLanguage: parsed.data.defaultLanguage, ...parsed.data.flags },
      { pathParams: { id: userId } },
    );
    return { success: true, data: { userId } };
  } catch (error) {
    return failure(error, "settingsFailed");
  }
}

export async function createCalendarToken(
  userId: string,
): Promise<ActionResult<{ tokenId: string }>> {
  try {
    const created = await apiPost<{ id: string }>("/v1/users/{id}/calendar-tokens", undefined, {
      pathParams: { id: userId },
    });
    return { success: true, data: { tokenId: created.id } };
  } catch (error) {
    return failure(error, "calendarFailed");
  }
}

/** Expiring is the only revocation core-api offers -- the record stays, marked. */
export async function expireCalendarToken(
  tokenId: string,
): Promise<ActionResult<{ tokenId: string }>> {
  try {
    await apiDelete("/v1/users/ical/{id}", { pathParams: { id: tokenId } });
    return { success: true, data: { tokenId } };
  } catch (error) {
    return failure(error, "calendarFailed");
  }
}
