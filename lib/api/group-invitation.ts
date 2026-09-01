import "server-only";

import { cache } from "react";

import { localizedDescription, localizedName, type LocalizedText } from "@/lib/i18n-text/localized";

import { apiPost } from "./client";
import { getMyGroups } from "./groups";
import { apiRead } from "./read";

/**
 * A group invitation as the person who followed the link reads it (S-023).
 *
 * One request answers the whole screen. `GET /v1/group-invitations/{id}` returns the invitation
 * plus **the ancestral closure of its group** (`GroupInvitationsPresenter::actionDefault` calls
 * `groupsAncestralClosure`), which is there so a full name can be constructed -- "Lab A" alone
 * does not tell a student which course they are about to join.
 *
 * Whether the reader may join is `permissionHints.acceptInvitation` on that group, not anything
 * derived here. The other two conditions core-api's own `checkAccept` applies -- the invitation
 * has not expired, and the group is not organizational -- are not in the hint, so they are
 * mirrored: a button that 403s is worse than a button that is not offered. `archived` is *not*
 * mirrored, because that one **is** already inside the hint (`group.isNotArchived` is a condition
 * on the `acceptInvitation` rule in `permissions.neon`), and restating it here would be a second
 * copy of the same rule, free to drift.
 *
 * Reading the invitation needs only `canViewInvitations`, which every student in the instance has
 * -- so a reader who may look is not necessarily a reader who may join, and the two are separate
 * fields here for that reason.
 */
export interface InvitationGroup {
  id: string;
  name: string;
  /** Ancestor names, outermost first. Empty for a top-level group. */
  path: string[];
  /** Markdown, in the reader's locale where it exists. */
  description: string;
  organizational: boolean;
  archived: boolean;
  admins: { id: string; fullName: string }[];
}

export interface GroupInvitationDetail {
  id: string;
  groupId: string;
  note: string;
  createdAt: number;
  /** `null` means the invitation never expires -- core-api's own nullable `expireAt`. */
  expireAt: number | null;
  hasExpired: boolean;
  group: InvitationGroup;
  /** True when the reader already studies in this group, so there is nothing left to accept. */
  alreadyMember: boolean;
  /** True when core-api would accept this reader's join request right now. */
  canAccept: boolean;
}

interface InvitationPayload {
  id: string;
  groupId: string;
  hostId: string;
  createdAt: number;
  expireAt?: number | null;
  note?: string | null;
}

interface InvitationGroupPayload {
  id: string;
  organizational: boolean;
  archived: boolean;
  localizedTexts?: LocalizedText[];
  primaryAdminsIds?: string[];
  parentGroupsIds?: string[];
  permissionHints?: Record<string, boolean>;
}

interface InvitationDetailPayload {
  invitation: InvitationPayload;
  groups: InvitationGroupPayload[];
}

export const getGroupInvitation = cache(async function getGroupInvitation(
  invitationId: string,
  locale: string,
): Promise<GroupInvitationDetail> {
  const payload = await apiRead<InvitationDetailPayload>("/v1/group-invitations/{id}", {
    pathParams: { id: invitationId },
  });

  const { invitation } = payload;
  const byId = new Map(payload.groups.map((group) => [group.id, group]));
  const group = byId.get(invitation.groupId);

  // The invitation exists but its group did not come back with it. core-api only omits a group it
  // has deleted, which is the same dead link as an unknown invitation id -- and there is nothing
  // left to render either way.
  if (!group) {
    return {
      id: invitation.id,
      groupId: invitation.groupId,
      note: invitation.note ?? "",
      createdAt: invitation.createdAt,
      expireAt: invitation.expireAt ?? null,
      hasExpired: true,
      group: {
        id: invitation.groupId,
        name: "",
        path: [],
        description: "",
        organizational: false,
        archived: false,
        admins: [],
      },
      alreadyMember: false,
      canAccept: false,
    };
  }

  const admins = group.primaryAdminsIds ?? [];
  const [people, mine] = await Promise.all([
    admins.length > 0
      ? apiPost<{ id: string; fullName: string }[]>("/v1/users/list", { ids: admins })
      : Promise.resolve([]),
    // The reader's own memberships, which the app shell has already fetched for its sidebar on
    // this very render -- memoized, so asking again costs nothing.
    getMyGroups(locale),
  ]);

  const names = new Map(people.map((person) => [person.id, person.fullName]));
  const expireAt = invitation.expireAt ?? null;
  const hasExpired = expireAt !== null && expireAt * 1000 <= Date.now();
  const alreadyMember = mine.member.some((group) => group.id === invitation.groupId);

  return {
    id: invitation.id,
    groupId: invitation.groupId,
    note: invitation.note ?? "",
    createdAt: invitation.createdAt,
    expireAt,
    hasExpired,
    group: {
      id: group.id,
      name: localizedName(group.localizedTexts, locale),
      path: (group.parentGroupsIds ?? [])
        .map((id) => byId.get(id))
        .filter((ancestor) => ancestor !== undefined)
        .map((ancestor) => localizedName(ancestor.localizedTexts, locale))
        .filter((name) => name !== ""),
      description: localizedDescription(group.localizedTexts, locale),
      organizational: group.organizational,
      archived: group.archived,
      admins: admins.map((id) => ({ id, fullName: names.get(id) ?? "" })),
    },
    alreadyMember,
    canAccept:
      group.permissionHints?.acceptInvitation === true &&
      !hasExpired &&
      !group.organizational &&
      !alreadyMember,
  };
});
