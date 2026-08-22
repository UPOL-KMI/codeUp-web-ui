import "server-only";

import { cache } from "react";

import { localizedName, type LocalizedText } from "@/lib/i18n-text/localized";

import { apiGet, apiPost } from "./client";
import { getMyGroupStats, type GroupStudentStats } from "./groups";

/**
 * One group, as its own screen needs it (S-005, S-006, S-007).
 *
 * Member **names** are resolved with one batched `POST /v1/users/list` over the id arrays in
 * `privateData`, rather than with `GET /v1/groups/{id}/members`. That endpoint exists and returns
 * ready-made user objects, but core-api marks it `@deprecated` ("Members are listed in group
 * view") and it omits observers entirely -- so it is both the endpoint being retired and the one
 * that answers less. One batched lookup covers all three roles from data the group view already
 * returned.
 */
export interface GroupMember {
  id: string;
  fullName: string;
  role: "admin" | "supervisor" | "observer";
}

export interface GroupRef {
  id: string;
  name: string;
}

export interface GroupDetail {
  id: string;
  name: string;
  /** Markdown, in the reader's locale where it exists. Empty when the group has no description. */
  description: string;
  /** Ancestors, outermost first. */
  path: GroupRef[];
  subgroups: GroupRef[];
  organizational: boolean;
  public: boolean;
  archived: boolean;
  exam: boolean;
  publicStats: boolean;
  detaining: boolean;
  /** Percentage (0-1) or absolute points needed to pass; core-api stores one or the other. */
  threshold: number | null;
  pointsLimit: number | null;
  members: GroupMember[];
  studentCount: number | null;
  assignmentCount: number;
  /** The reader's own standing, when they study here. */
  myStats: GroupStudentStats | null;
  /** core-api's own answer to what this reader may do (brief §3.4) -- never re-derived from roles. */
  can: Record<string, boolean>;
}

interface GroupPayload {
  id: string;
  localizedTexts?: LocalizedText[];
  organizational?: boolean;
  public?: boolean;
  archived?: boolean;
  exam?: boolean;
  parentGroupsIds?: string[];
  childGroups?: string[];
  privateData?: {
    admins?: string[];
    supervisors?: string[];
    observers?: string[];
    students?: string[];
    assignments?: string[];
    publicStats?: boolean;
    detaining?: boolean;
    threshold?: number | null;
    pointsLimit?: number | null;
  };
  permissionHints?: Record<string, boolean>;
}

function localizedDescription(texts: LocalizedText[] | undefined, locale: string): string {
  if (!texts?.length) return "";
  const match = texts.find((text) => text.locale === locale && text.description);
  return (match ?? texts.find((text) => text.description))?.description ?? "";
}

const fetchGroup = cache(async function fetchGroup(groupId: string): Promise<GroupPayload> {
  return apiGet<GroupPayload>("/v1/groups/{id}", { pathParams: { id: groupId } });
});

export const getGroupDetail = cache(async function getGroupDetail(
  groupId: string,
  locale: string,
): Promise<GroupDetail> {
  const group = await fetchGroup(groupId);
  const priv = group.privateData;

  const memberRoles: [string, GroupMember["role"]][] = [
    ...(priv?.admins ?? []).map((id): [string, GroupMember["role"]] => [id, "admin"]),
    ...(priv?.supervisors ?? []).map((id): [string, GroupMember["role"]] => [id, "supervisor"]),
    ...(priv?.observers ?? []).map((id): [string, GroupMember["role"]] => [id, "observer"]),
  ];
  const memberIds = [...new Set(memberRoles.map(([id]) => id))];

  const [ancestors, subgroups, people, statsByGroup] = await Promise.all([
    // Named one by one rather than from the group list: an ancestor can be a group this reader is
    // not a member of, which `/v1/groups` need not have returned. `fetchGroup` is memoized, so an
    // ancestor also shown elsewhere on the page costs nothing extra.
    Promise.all((group.parentGroupsIds ?? []).map((id) => fetchGroup(id).catch(() => null))),
    group.childGroups?.length
      ? apiGet<GroupPayload[]>("/v1/groups/{id}/subgroups", { pathParams: { id: groupId } })
      : Promise.resolve([]),
    memberIds.length > 0
      ? apiPost<{ id: string; fullName: string }[]>("/v1/users/list", { ids: memberIds })
      : Promise.resolve([]),
    getMyGroupStats(),
  ]);

  const names = new Map(people.map((person) => [person.id, person.fullName]));

  return {
    id: group.id,
    name: localizedName(group.localizedTexts, locale),
    description: localizedDescription(group.localizedTexts, locale),
    path: ancestors
      .filter((ancestor): ancestor is GroupPayload => ancestor !== null)
      .map((ancestor) => ({
        id: ancestor.id,
        name: localizedName(ancestor.localizedTexts, locale),
      })),
    subgroups: subgroups.map((subgroup) => ({
      id: subgroup.id,
      name: localizedName(subgroup.localizedTexts, locale),
    })),
    organizational: group.organizational ?? false,
    public: group.public ?? false,
    archived: group.archived ?? false,
    exam: group.exam ?? false,
    publicStats: priv?.publicStats ?? false,
    detaining: priv?.detaining ?? false,
    threshold: priv?.threshold ?? null,
    pointsLimit: priv?.pointsLimit ?? null,
    members: memberRoles.map(([id, role]) => ({
      id,
      // A name core-api declined to disclose is not a reason to drop the person: that they hold
      // the role is the fact this list is about.
      fullName: names.get(id) ?? "",
      role,
    })),
    studentCount: priv?.students?.length ?? null,
    assignmentCount: priv?.assignments?.length ?? 0,
    myStats: statsByGroup.get(groupId) ?? null,
    can: group.permissionHints ?? {},
  };
});
