import "server-only";

import { cache } from "react";

import { localizedDescription, localizedName, type LocalizedText } from "@/lib/i18n-text/localized";
import { parseExamLockType, type ExamLockType } from "@/lib/status/exam";

import { apiGet, apiPost } from "./client";
import { apiRead, pageRead } from "./read";
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

/** One locale's name and description, as core-api stores and expects them back. */
export interface GroupText {
  locale: string;
  name: string;
  description: string;
}

export interface GroupDetail {
  id: string;
  name: string;
  /** Every locale core-api holds for this group -- what the settings form edits (S-009). */
  texts: GroupText[];
  /** The course code or similar the deployment keeps beside the name; free-form, often empty. */
  externalId: string;
  /** Markdown, in the reader's locale where it exists. Empty when the group has no description. */
  description: string;
  /** Ancestors, outermost first. */
  path: GroupRef[];
  /** The group this one hangs under. Null only for an instance's root group, which cannot move. */
  parentGroupId: string | null;
  subgroups: GroupRef[];
  organizational: boolean;
  public: boolean;
  archived: boolean;
  /** Archived in its own right, as opposed to inheriting it from an archived ancestor (S-009). */
  directlyArchived: boolean;
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
  /** Ids of the group's students, when this reader may see them -- the exam roster is built from these. */
  studentIds: string[];
  /** The exam this group is currently running or about to (S-008). Null when none is set. */
  examTerm: ExamTerm | null;
  /** Exams that have been recorded, newest last. core-api only records one once a student locks in. */
  exams: ExamTerm[];
  /** core-api's own answer to what this reader may do (brief §3.4) -- never re-derived from roles. */
  can: Record<string, boolean>;
}

export interface ExamTerm {
  /** Absent on the group's own current period -- core-api records an exam entity only on the first lock. */
  id: number | null;
  begin: number;
  end: number;
  lockType: ExamLockType | null;
}

interface GroupPayload {
  id: string;
  externalId?: string | null;
  localizedTexts?: LocalizedText[];
  organizational?: boolean;
  public?: boolean;
  archived?: boolean;
  directlyArchived?: boolean;
  exam?: boolean;
  parentGroupId?: string | null;
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
    examBegin?: number | null;
    examEnd?: number | null;
    examLockType?: string | null;
    exams?: { id: number; begin: number; end: number; type?: string | null }[];
  };
  permissionHints?: Record<string, boolean>;
}

// Raw on purpose: an ancestor is fetched through here too, and that call tolerates its own
// failure -- a `catch` around a refusal interrupt would swallow it (F-030). The group this page
// is about goes through `pageRead` at its own call site instead.
const fetchGroup = cache(async function fetchGroup(groupId: string): Promise<GroupPayload> {
  return apiGet<GroupPayload>("/v1/groups/{id}", { pathParams: { id: groupId } });
});

export const getGroupDetail = cache(async function getGroupDetail(
  groupId: string,
  locale: string,
): Promise<GroupDetail> {
  const group = await pageRead(fetchGroup(groupId));
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
      ? apiRead<GroupPayload[]>("/v1/groups/{id}/subgroups", { pathParams: { id: groupId } })
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
    texts: (group.localizedTexts ?? []).map((text) => ({
      locale: text.locale,
      name: text.name ?? "",
      description: text.description ?? "",
    })),
    externalId: group.externalId ?? "",
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
    parentGroupId: group.parentGroupId ?? null,
    organizational: group.organizational ?? false,
    public: group.public ?? false,
    archived: group.archived ?? false,
    directlyArchived: group.directlyArchived ?? false,
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
    studentIds: priv?.students ?? [],
    examTerm:
      priv?.examBegin && priv?.examEnd
        ? {
            id: null,
            begin: priv.examBegin,
            end: priv.examEnd,
            lockType: parseExamLockType(priv.examLockType),
          }
        : null,
    exams: [...(priv?.exams ?? [])]
      .sort((a, b) => a.end - b.end || a.begin - b.begin)
      .map((exam) => ({
        id: exam.id,
        begin: exam.begin,
        end: exam.end,
        lockType: parseExamLockType(exam.type),
      })),
    can: group.permissionHints ?? {},
  };
});

/**
 * The groups this one could be moved under (S-009), the legacy app's own filter
 * (`getPossibleParentsOfGroup`): anything the reader may add a subgroup to, except this group
 * itself and its own descendants -- moving a group under its own child would make the hierarchy a
 * loop, which core-api refuses anyway (`checkRelocate`).
 *
 * Archived groups are absent because `/v1/groups` omits them unless asked, which is the right
 * answer here for a second reason: an archived group is immutable, so it is no place to move
 * anything into.
 */
export async function getRelocationTargets(groupId: string, locale: string): Promise<GroupRef[]> {
  const groups = await apiRead<GroupPayload[]>("/v1/groups");

  return groups
    .filter(
      (candidate) =>
        candidate.id !== groupId &&
        candidate.permissionHints?.addSubgroup === true &&
        !(candidate.parentGroupsIds ?? []).includes(groupId),
    )
    .map((candidate) => ({
      id: candidate.id,
      name: [
        ...(candidate.parentGroupsIds ?? [])
          .map((id) => groups.find((group) => group.id === id))
          .filter((group): group is GroupPayload => group !== undefined)
          .map((group) => localizedName(group.localizedTexts, locale)),
        localizedName(candidate.localizedTexts, locale),
      ].join(" / "),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

/**
 * The group's assignments, with the reader's own standing on each where they study here (S-006).
 *
 * The filter is applied server-side and lives in the URL, so "the open ones" is a shareable link
 * and no assignment the reader filtered out is shipped to the browser. `submitted` means "I have
 * an evaluated solution", which is the only sense the stats row can answer -- see Q-012 for the
 * case it cannot distinguish.
 */
export type AssignmentFilter = "all" | "open" | "closed" | "submitted";

export interface GroupAssignment {
  id: string;
  name: string;
  firstDeadline: number;
  secondDeadline: number | null;
  allowSecondDeadline: boolean;
  maxPoints: number;
  maxPointsSecond: number;
  isBonus: boolean;
  isPublic: boolean;
  /** The reader's own result, when they study in this group. */
  stats: {
    status: string | null;
    gained: number | null;
    bonus: number | null;
    total: number;
    accepted: boolean | null;
    bestSolutionId: string | null;
  } | null;
}

interface AssignmentPayload {
  id: string;
  localizedTexts?: LocalizedText[];
  firstDeadline: number;
  secondDeadline: number;
  allowSecondDeadline: boolean;
  maxPointsBeforeFirstDeadline: number;
  maxPointsBeforeSecondDeadline: number;
  isBonus: boolean;
  isPublic: boolean;
}

export async function getGroupAssignments(
  groupId: string,
  locale: string,
  filter: AssignmentFilter,
): Promise<GroupAssignment[]> {
  const [assignments, statsByGroup] = await Promise.all([
    apiRead<AssignmentPayload[]>("/v1/groups/{id}/assignments", { pathParams: { id: groupId } }),
    getMyGroupStats(),
  ]);

  const myStats = statsByGroup.get(groupId);
  const statsByAssignment = new Map((myStats?.assignments ?? []).map((row) => [row.id, row]));
  const now = Date.now() / 1000;

  return assignments
    .map((assignment) => {
      const stats = statsByAssignment.get(assignment.id);
      const hasSecond = assignment.allowSecondDeadline && assignment.secondDeadline > 0;
      return {
        id: assignment.id,
        name: localizedName(assignment.localizedTexts, locale),
        firstDeadline: assignment.firstDeadline,
        secondDeadline: hasSecond ? assignment.secondDeadline : null,
        allowSecondDeadline: assignment.allowSecondDeadline,
        maxPoints: assignment.maxPointsBeforeFirstDeadline,
        maxPointsSecond: assignment.maxPointsBeforeSecondDeadline,
        isBonus: assignment.isBonus,
        isPublic: assignment.isPublic,
        stats: myStats
          ? {
              status: stats?.status ?? null,
              gained: stats?.points.gained ?? null,
              bonus: stats?.points.bonus ?? null,
              total: stats?.points.total ?? assignment.maxPointsBeforeFirstDeadline,
              accepted: stats?.accepted ?? null,
              bestSolutionId: stats?.bestSolutionId ?? null,
            }
          : null,
      };
    })
    .filter((assignment) => {
      const effective = assignment.secondDeadline ?? assignment.firstDeadline;
      switch (filter) {
        case "open":
          return effective > now;
        case "closed":
          return effective <= now;
        case "submitted":
          return assignment.stats?.status != null;
        default:
          return true;
      }
    })
    .sort((a, b) => a.firstDeadline - b.firstDeadline || a.name.localeCompare(b.name, locale));
}

/**
 * The group's roster with each student's points (S-007).
 *
 * `GET /v1/groups/{id}/students/stats` answers with every student's row for a reader who may see
 * group stats, and with only their own row for one who may not -- core-api decides that itself
 * (`GroupsPresenter::actionStats`), so this does not gate on a role. Names come from the same
 * batched `/v1/users/list` the member list uses.
 *
 * Per-assignment points are deliberately **not** a column each: that matrix is T-006's screen,
 * where it can be sorted, exported and read at full width. Here each student is one row -- points,
 * whether they pass, how many assignments they have solved.
 */
export interface GroupStudent {
  id: string;
  fullName: string;
  gained: number;
  total: number;
  hasLimit: boolean;
  passesLimit: boolean;
  solvedCount: number;
  assignmentCount: number;
}

export async function getGroupStudents(groupId: string): Promise<GroupStudent[]> {
  const stats = await apiRead<GroupStudentStats[]>("/v1/groups/{id}/students/stats", {
    pathParams: { id: groupId },
  });
  if (stats.length === 0) return [];

  const people = await apiPost<{ id: string; fullName: string }[]>("/v1/users/list", {
    ids: [...new Set(stats.map((row) => row.userId))],
  });
  const names = new Map(people.map((person) => [person.id, person.fullName]));

  return stats
    .map((row) => ({
      id: row.userId,
      fullName: names.get(row.userId) ?? "",
      gained: row.points.gained,
      total: row.points.total,
      hasLimit: row.hasLimit,
      passesLimit: row.passesLimit,
      solvedCount: row.assignments.filter((assignment) => assignment.status === "done").length,
      assignmentCount: row.assignments.length,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}
