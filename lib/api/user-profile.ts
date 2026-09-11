import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";

import { localizedName, type LocalizedText } from "@/lib/i18n-text/localized";

import { ApiError, apiGet } from "./client";
import { apiRead } from "./read";

/**
 * One person's profile (S-021): who they are, and where in ReCodEx they belong.
 *
 * **`privateData` is absent, not empty, for a reader who may not see it** -- core-api builds the
 * whole block only under `canViewPrivateData` (`UserViewFactory::getUserData`), so every field
 * from it is optional here and the page renders the rows it was given rather than a table of
 * blanks.
 *
 * **A user carries no `permissionHints` at all** -- confirmed against a live response, where the
 * field is `null` even for a superadmin reading a student. So the group list cannot be gated on a
 * hint the way every other screen in this app gates: it is attempted, and a 403 is read as "not
 * disclosed to you" (`getUserGroups` returns null). That is the same shape the teacher dashboard's
 * review queue uses, and for the same reason -- asking core-api and believing the answer beats
 * reimplementing its rule here.
 */
export interface UserProfile {
  id: string;
  fullName: string;
  titlesBeforeName: string;
  firstName: string;
  lastName: string;
  titlesAfterName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  /** Present only when this reader may see the person's private data. */
  email: string | null;
  role: string | null;
  createdAt: number | null;
  lastAuthenticationAt: number | null;
  /** External identities (CAS and the like), keyed by authentication service. */
  externalIds: Record<string, string>;
  /** False for an account an administrator has disabled. */
  isAllowed: boolean | null;
  can: Record<string, boolean>;
}

interface UserPayload {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  isVerified?: boolean;
  name?: {
    titlesBeforeName?: string;
    firstName?: string;
    lastName?: string;
    titlesAfterName?: string;
  };
  privateData?: {
    email?: string;
    role?: string;
    createdAt?: number;
    lastAuthenticationAt?: number | null;
    externalIds?: Record<string, string> | unknown[];
    isAllowed?: boolean;
  } | null;
  permissionHints?: Record<string, boolean>;
}

export const getUserProfile = cache(async function getUserProfile(
  userId: string,
): Promise<UserProfile> {
  const user = await apiRead<UserPayload>("/v1/users/{id}", { pathParams: { id: userId } });
  const external = user.privateData?.externalIds;

  return {
    id: user.id,
    fullName: user.fullName,
    titlesBeforeName: user.name?.titlesBeforeName ?? "",
    firstName: user.name?.firstName ?? "",
    lastName: user.name?.lastName ?? "",
    titlesAfterName: user.name?.titlesAfterName ?? "",
    avatarUrl: user.avatarUrl ?? null,
    isVerified: user.isVerified === true,
    email: user.privateData?.email ?? null,
    role: user.privateData?.role ?? null,
    createdAt: user.privateData?.createdAt ?? null,
    lastAuthenticationAt: user.privateData?.lastAuthenticationAt ?? null,
    // core-api sends an empty *array* when there are none and an object when there are -- both
    // shapes confirmed live, which is why this is not simply spread.
    externalIds: external && !Array.isArray(external) ? (external as Record<string, string>) : {},
    isAllowed: user.privateData?.isAllowed ?? null,
    can: user.permissionHints ?? {},
  };
});

export interface UserGroupMembership {
  id: string;
  name: string;
  /** How the person belongs: studying here, or teaching here. */
  role: "student" | "supervisor";
}

interface GroupPayload {
  id: string;
  localizedTexts?: LocalizedText[];
  archived?: boolean;
}

/**
 * The groups this person belongs to, as core-api reports them for *that* person -- not derived
 * from the reader's own memberships. Archived groups are already filtered out by core-api
 * (`UsersPresenter::actionGroups`), which is the same answer the group list gives by default.
 */
export const getUserGroups = cache(async function getUserGroups(
  userId: string,
  locale: string,
): Promise<UserGroupMembership[] | null> {
  let payload: { student?: GroupPayload[]; supervisor?: GroupPayload[] };
  try {
    // Raw client on purpose: a 403 here is an answer this page renders around, not a refusal of
    // the page (F-030's own carve-out for reads that handle their own failure).
    payload = await apiGet<{ student?: GroupPayload[]; supervisor?: GroupPayload[] }>(
      "/v1/users/{id}/groups",
      { pathParams: { id: userId } },
    );
  } catch (error) {
    if (error instanceof ApiError && error.httpStatus === 403) return null;
    // **The carve-out is 403 and only 403.** A 404 here means the person does not exist, which is
    // the whole page's answer rather than one section's -- and `ProfileView` awaits this alongside
    // two reads that *do* raise the interrupt, in one `Promise.all`. `Promise.all` rejects with
    // whichever settles first, so letting a raw `ApiError` out of this one made the reader's answer
    // a race: usually the Not found page, sometimes "Something went wrong" for the same URL.
    if (error instanceof ApiError && error.httpStatus === 404) notFound();
    throw error;
  }

  const memberships = new Map<string, UserGroupMembership>();
  for (const group of payload.student ?? []) {
    memberships.set(group.id, {
      id: group.id,
      name: localizedName(group.localizedTexts, locale),
      role: "student",
    });
  }
  // Teaching wins where someone does both -- it is the more consequential relationship, and the
  // legacy page lists such a person under supervisors too.
  for (const group of payload.supervisor ?? []) {
    memberships.set(group.id, {
      id: group.id,
      name: localizedName(group.localizedTexts, locale),
      role: "supervisor",
    });
  }

  return [...memberships.values()].sort(
    (a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name, locale),
  );
});
