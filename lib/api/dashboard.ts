import "server-only";

import { localizedName, type LocalizedText } from "@/lib/i18n-text/localized";

import { apiGet } from "./client";
import { getMyGroups, getMyGroupStats, type GroupAssignmentStats } from "./groups";

/**
 * The student half of the dashboard (S-001), assembled server-side so the browser makes no
 * follow-up request and sees no waterfall (`docs/IA.md` §3.2).
 *
 * Two sources, and only one of them costs anything here: the per-group student stats arrive with
 * the group list the app shell already fetches (see `fetchUserGroups`), so the only additional
 * calls are one `/v1/groups/{id}/assignments` per group the user studies in. There is no
 * collection endpoint for assignments to replace those with -- checked against core-api's own
 * router, the same gap Q-011 records for search -- so a per-group fan-out is the shape available,
 * not a first draft to optimise later.
 */
export interface UpcomingAssignment {
  id: string;
  name: string;
  groupId: string;
  groupName: string;
  firstDeadline: number;
  secondDeadline: number | null;
  allowSecondDeadline: boolean;
  /** The deadline this row is sorted and filtered by: the second one where it still applies. */
  effectiveDeadline: number;
  isBonus: boolean;
  stats: Pick<GroupAssignmentStats, "status" | "accepted"> & {
    gained: number | null;
    bonus: number | null;
    total: number;
  };
}

export interface GroupProgress {
  id: string;
  name: string;
  gained: number;
  total: number;
  limit: number | null;
  hasLimit: boolean;
  passesLimit: boolean;
  assignmentCount: number;
  solvedCount: number;
}

export interface StudentDashboard {
  /** Still open for submission, nearest deadline first. */
  upcoming: UpcomingAssignment[];
  /** One entry per group the user studies in, in the order the sidebar lists them. */
  progress: GroupProgress[];
}

interface AssignmentPayload {
  id: string;
  groupId: string;
  localizedTexts?: LocalizedText[];
  firstDeadline: number;
  secondDeadline: number;
  allowSecondDeadline: boolean;
  maxPointsBeforeFirstDeadline: number;
  isBonus: boolean;
}

/**
 * `secondDeadline` is `0`, not `null`, when an assignment has none -- confirmed on a live
 * response. Reading it without this guard produces a 1970 date, and worse, a comparison that
 * silently reports every such assignment as long closed.
 */
function effectiveDeadlineOf(assignment: AssignmentPayload): number {
  return assignment.allowSecondDeadline && assignment.secondDeadline > 0
    ? assignment.secondDeadline
    : assignment.firstDeadline;
}

export async function getStudentDashboard(locale: string): Promise<StudentDashboard> {
  const { member } = await getMyGroups(locale);
  if (member.length === 0) return { upcoming: [], progress: [] };

  const [statsByGroup, assignmentsPerGroup] = await Promise.all([
    getMyGroupStats(),
    Promise.all(
      member.map((group) =>
        apiGet<AssignmentPayload[]>("/v1/groups/{id}/assignments", {
          pathParams: { id: group.id },
        }),
      ),
    ),
  ]);

  // Filtering by "now" on the server is safe where rendering it would not be (AGENTS.md §6.6):
  // this decides which rows exist, once, and the client renders exactly that list -- nothing is
  // recomputed during hydration, and nothing here is cached to go stale.
  const now = Date.now() / 1000;
  const upcoming: UpcomingAssignment[] = [];
  const progress: GroupProgress[] = [];

  member.forEach((group, index) => {
    const assignments = assignmentsPerGroup[index]!;
    const groupStats = statsByGroup.get(group.id);
    const statsByAssignment = new Map(
      (groupStats?.assignments ?? []).map((stats) => [stats.id, stats]),
    );

    for (const assignment of assignments) {
      const stats = statsByAssignment.get(assignment.id);
      const effectiveDeadline = effectiveDeadlineOf(assignment);
      if (effectiveDeadline <= now) continue;

      upcoming.push({
        id: assignment.id,
        name: localizedName(assignment.localizedTexts, locale),
        groupId: group.id,
        groupName: group.name,
        firstDeadline: assignment.firstDeadline,
        secondDeadline: assignment.secondDeadline > 0 ? assignment.secondDeadline : null,
        allowSecondDeadline: assignment.allowSecondDeadline,
        effectiveDeadline,
        isBonus: assignment.isBonus,
        stats: {
          status: stats?.status ?? null,
          accepted: stats?.accepted ?? null,
          gained: stats?.points.gained ?? null,
          bonus: stats?.points.bonus ?? null,
          // The stats row is the authority on an assignment's maximum where it exists, but a
          // student can see an assignment that no stats row covers (a group joined moments ago),
          // and a missing maximum would render every such row as "0 points available".
          total: stats?.points.total ?? assignment.maxPointsBeforeFirstDeadline,
        },
      });
    }

    if (groupStats) {
      progress.push({
        id: group.id,
        name: group.name,
        gained: groupStats.points.gained,
        total: groupStats.points.total,
        limit: groupStats.points.limit,
        hasLimit: groupStats.hasLimit,
        passesLimit: groupStats.passesLimit,
        assignmentCount: groupStats.assignments.length,
        solvedCount: groupStats.assignments.filter((stats) => stats.status === "done").length,
      });
    }
  });

  upcoming.sort(
    (a, b) => a.effectiveDeadline - b.effectiveDeadline || a.name.localeCompare(b.name, locale),
  );

  return { upcoming, progress };
}
