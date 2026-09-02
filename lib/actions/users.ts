"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiDelete, apiPost } from "@/lib/api/client";
import { getCurrentUser } from "@/lib/api/current-user";
import type { ActionResult } from "@/lib/forms/action-result";

import { createUserSchema, type CreateUserValues } from "./users.schema";

/**
 * What can be done to an account from the user list (AD-001): let it in, shut it out, or end it.
 *
 * **core-api is the authorisation here, not this file.** A user object carries no
 * `permissionHints` at all (DEC-080, verified again for the list payload), so there is no hint to
 * gate on and nothing to re-check that core-api will not check better: every call below travels on
 * the caller's own session token, and `user.setIsAllowed` / `user.delete` / `user.create` are the
 * superadmin's alone (`permissions.neon`'s blanket `role: superadmin` allow). The screen decides
 * what to *offer* from the reader's role, which is what the legacy app does and the only thing
 * available; what actually happens is decided one layer down, where it cannot be skipped.
 *
 * No `revalidatePath` (DEC-021): every read is `no-store`, and the caller refreshes the router.
 */
async function failure(error: unknown, fallbackKey: string): Promise<ActionResult<never>> {
  const t = await getTranslations("Users.errors");
  return {
    success: false,
    formError: error instanceof ApiError ? error.message : t(fallbackKey),
  };
}

/**
 * Disabling an account is not deleting it: the person keeps their solutions and their groups, and
 * core-api refuses them every operation until somebody sets this back. It refuses to accept the
 * flag being changed on *oneself*, which is why the list never offers it on the reader's own row.
 */
export async function setUserAllowed(
  userId: string,
  isAllowed: boolean,
): Promise<ActionResult<{ isAllowed: boolean }>> {
  try {
    await apiPost("/v1/users/{id}/allowed", { isAllowed }, { pathParams: { id: userId } });
    return { success: true, data: { isAllowed } };
  } catch (error) {
    return failure(error, "allowedFailed");
  }
}

/**
 * **Deleting an account anonymises it rather than erasing it.** core-api's `actionDelete` runs
 * `prepareUserForSoftDelete` first -- the name, the email and the external identities go, the
 * solutions and the points they earned stay, attached to a person nobody can name any more. The
 * confirmation says exactly that, because "delete" alone would promise both more and less than
 * what happens.
 */
export async function deleteUserAccount(userId: string): Promise<ActionResult<{ id: string }>> {
  try {
    await apiDelete("/v1/users/{id}", { pathParams: { id: userId } });
    return { success: true, data: { id: userId } };
  } catch (error) {
    return failure(error, "deleteFailed");
  }
}

/**
 * A name collision is a question, not a failure -- the same answer A-003's registration form
 * handles, from the other side of the desk. core-api replies `{user: null, usersWithSameName}` and
 * a 200 when somebody with that first and last name already exists in the instance; it is asking
 * whether this is that person again.
 */
export type CreateUserOutcome =
  { created: true; id: string } | { created: false; sameName: string[] };

/**
 * Creating an account for somebody else (AD-001).
 *
 * The same endpoint the public registration form uses, and **that is why it is reachable at all on
 * a deployment with registration switched off**: `checkCreateAccount` only demands `user.create`
 * when `localRegistration` is disabled, so here it is a superadmin's call rather than an
 * anonymous one. Nothing about the caller's own session changes -- core-api returns an access
 * token for the new account and this action drops it, which is the legacy app's
 * "createdBySuperadmin, skip auth changes" restated. Signing the administrator in as the person
 * they just created is exactly the accident to avoid.
 *
 * The new account is always a **student**: core-api hardcodes `Roles::STUDENT_ROLE` here, and
 * changing it afterwards is `setRole` on the account's own settings screen (AD-002).
 *
 * The instance is the creating administrator's own first one -- there is no picker, because the
 * legacy screen has none either and `privateData.instancesIds[0]` is what it uses.
 *
 * core-api also sends a verification email at this point. This deployment has no outbound SMTP
 * (Q-007/ASS-008), so on it that mail exists only in the API's archive directory.
 */
export async function createUserAccount(
  values: CreateUserValues,
): Promise<ActionResult<CreateUserOutcome>> {
  const t = await getTranslations("Users.errors");
  const parsed = createUserSchema.safeParse(values);
  if (!parsed.success) return { success: false, formError: t("invalid") };

  const instanceId = (await getCurrentUser()).instanceIds[0];
  if (!instanceId) return { success: false, formError: t("noInstance") };

  try {
    const result = await apiPost<{
      user: { id: string } | null;
      usersWithSameName?: { fullName: string }[];
    }>("/v1/users", {
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      password: parsed.data.password,
      passwordConfirm: parsed.data.passwordConfirm,
      instanceId,
      ...(parsed.data.ignoreNameCollision && { ignoreNameCollision: true }),
    });

    if (!result.user) {
      return {
        success: true,
        data: {
          created: false,
          sameName: (result.usersWithSameName ?? []).map((person) => person.fullName),
        },
      };
    }

    return { success: true, data: { created: true, id: result.user.id } };
  } catch (error) {
    return failure(error, "createFailed");
  }
}
