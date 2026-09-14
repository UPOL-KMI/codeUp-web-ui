"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiDelete, apiPost } from "@/lib/api/client";
import type { ActionResult } from "@/lib/forms/action-result";

/**
 * A person's identifiers in other systems (AD-002), one per issuing service.
 *
 * **core-api stores these as a key-value list and nothing more**: `service` names the system that
 * issued the identifier and is a free string, `externalId` is what it issued. They are what
 * `POST /v1/login/{service}` matches an arriving single-sign-on token against, which is why the
 * same rows are worth filling in long before any such sign-in exists -- an identifier recorded now
 * is a person recognised automatically later.
 *
 * **core-api refuses an identifier that already belongs to someone else** (`400`,
 * "This ID is already used by another user."), which is the duplicate check this screen would
 * otherwise have to invent and get wrong. Its message is English, so it is not what the reader is
 * shown; the caller's own sentence is.
 *
 * Authorisation is core-api's: a user object carries no `permissionHints` (DEC-080), so the
 * screens offer this on the reader's role and `user.setExternalIds` decides.
 */
async function failure(error: unknown, fallbackKey: string): Promise<ActionResult<never>> {
  const t = await getTranslations("UserEdit.externalIds.errors");
  // core-api names the argument it refused in the error's own parameters
  // (`InvalidApiArgumentException`), which is what separates "this number is somebody else's" from
  // any other bad request -- both of which arrive as the generic `400-000`.
  const taken =
    error instanceof ApiError &&
    error.code === "400-000" &&
    error.parameters?.argument === "externalId";
  return { success: false, formError: taken ? t("taken") : t(fallbackKey) };
}

export async function setUserExternalId(
  userId: string,
  service: string,
  externalId: string,
): Promise<ActionResult<{ service: string; externalId: string }>> {
  const trimmedService = service.trim();
  const trimmedId = externalId.trim();
  if (trimmedService === "" || trimmedId === "") {
    const t = await getTranslations("UserEdit.externalIds.errors");
    return { success: false, formError: t("incomplete") };
  }

  try {
    await apiPost(
      "/v1/users/{id}/external-login/{service}",
      { externalId: trimmedId },
      { pathParams: { id: userId, service: trimmedService } },
    );
    return { success: true, data: { service: trimmedService, externalId: trimmedId } };
  } catch (error) {
    return failure(error, "setFailed");
  }
}

export async function removeUserExternalId(
  userId: string,
  service: string,
): Promise<ActionResult<{ service: string }>> {
  try {
    await apiDelete("/v1/users/{id}/external-login/{service}", {
      pathParams: { id: userId, service },
    });
    return { success: true, data: { service } };
  } catch (error) {
    return failure(error, "removeFailed");
  }
}
