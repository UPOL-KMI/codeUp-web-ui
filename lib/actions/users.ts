"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiDelete, apiPost } from "@/lib/api/client";
import { getCurrentUser } from "@/lib/api/current-user";
import type { ActionResult } from "@/lib/forms/action-result";

import {
  createUserSchema,
  userRoleSchema,
  type CreateUserValues,
  type UserRoleValues,
} from "./users.schema";

/**
 * What can be done to somebody else's account -- from the directory (AD-001) and from the account's
 * own settings screen (AD-002): let it in, shut it out, end it, change what it may do, or hand it a
 * way to sign in.
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

/**
 * The role decides what the person may do everywhere in ReCodEx, so this is the most consequential
 * field on the screen (AD-002).
 *
 * **core-api refuses it on one's own account outright** -- `checkSetRole` compares the target with
 * the current user before the ACL even runs ("You cannot change your role"), which is the same
 * second check `setIsAllowed` carries. The screen never offers it there, because the administrator
 * editing themselves is sent to their own settings instead.
 *
 * The role name is validated twice on purpose: here against `USER_ROLES`, and by core-api's own
 * `Roles::validateRole`, which answers `400 Unknown user role` (verified live). A select cannot
 * produce a bad value, but a Server Action is a public endpoint that happens to have nice syntax.
 */
export async function setUserRole(
  userId: string,
  values: UserRoleValues,
): Promise<ActionResult<{ role: string }>> {
  const t = await getTranslations("Users.errors");
  const parsed = userRoleSchema.safeParse(values);
  if (!parsed.success) return { success: false, formError: t("unknownRole") };

  try {
    await apiPost(
      "/v1/users/{id}/role",
      { role: parsed.data.role },
      { pathParams: { id: userId } },
    );
    return { success: true, data: { role: parsed.data.role } };
  } catch (error) {
    return failure(error, "roleFailed");
  }
}

/**
 * Signing somebody out of everywhere (AD-002): core-api stamps a token validity threshold, and
 * every token issued before this moment stops working -- the browser they left signed in at the
 * lab, an extension holding a token, all of it.
 *
 * Distinct from disabling the account, which the same screen also offers: this one lets them
 * straight back in with their password, and is the answer to "my laptop was stolen" rather than to
 * "this person should not be here".
 */
export async function invalidateUserTokens(userId: string): Promise<ActionResult<{ id: string }>> {
  try {
    await apiPost("/v1/users/{id}/invalidate-tokens", undefined, { pathParams: { id: userId } });
    return { success: true, data: { id: userId } };
  } catch (error) {
    return failure(error, "invalidateFailed");
  }
}

/**
 * Giving an externally-authenticated account a local password as well (AD-002).
 *
 * **The password it creates is empty**, which is core-api's own design: the account then has a
 * local login that cannot be used until somebody sets a password on it, and the password form
 * beside this control is what does that. Offered only where the account has no local login --
 * core-api answers `400 User is already registered locally` otherwise (verified live), which is
 * an error rather than an answer.
 */
export async function createLocalLogin(userId: string): Promise<ActionResult<{ id: string }>> {
  try {
    await apiPost("/v1/users/{id}/create-local", undefined, { pathParams: { id: userId } });
    return { success: true, data: { id: userId } };
  } catch (error) {
    return failure(error, "localFailed");
  }
}
