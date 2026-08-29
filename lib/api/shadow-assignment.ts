import "server-only";

import { cache } from "react";

import { requireSession } from "@/lib/auth/require-session";
import { localizedName, type LocalizedText } from "@/lib/i18n-text/localized";

import { apiPost } from "./client";
import { apiRead, pageRead } from "./read";

/**
 * A shadow assignment (S-020): work ReCodEx does not evaluate, whose points a teacher awards by
 * hand -- an oral exam, a presentation, an attendance bonus.
 *
 * Everything that makes it different from a real assignment follows from that one fact. There is
 * no submission, so there is nothing to open; the **deadline is informative only**, and core-api
 * says so itself ("the points are awarded manually, so the supervisor ultimately decides whether a
 * deadline was breached"); and the points are records with an author, an awardee and a note,
 * rather than the result of an evaluation.
 *
 * `points` is filtered by core-api, not here: a reader with `viewAllPoints` gets every record, a
 * student gets only their own (`ShadowAssignmentViewFactory::getAssignmentPoints`).
 */
export interface ShadowPointsRecord {
  id: string;
  points: number;
  note: string;
  awardeeId: string | null;
  awardeeName: string;
  authorId: string | null;
  authorName: string;
  createdAt: number;
  /** When the teacher says the points were earned, which need not be when they typed them in. */
  awardedAt: number | null;
}

export interface ShadowAssignmentDetail {
  id: string;
  name: string;
  /** Markdown, in the reader's locale where it exists. */
  text: string;
  version: number;
  groupId: string | null;
  groupName: string;
  maxPoints: number;
  isBonus: boolean;
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
  /** Informative only -- nothing is enforced against it. */
  deadline: number | null;
  points: ShadowPointsRecord[];
  /** The reader's own record, when they are a student here. */
  myPoints: ShadowPointsRecord | null;
  can: Record<string, boolean>;
}

interface PointsPayload {
  id: string;
  points: number;
  note?: string | null;
  awardeeId?: string | null;
  authorId?: string | null;
  createdAt: number;
  awardedAt?: number | null;
}

interface ShadowAssignmentPayload {
  id: string;
  version: number;
  isPublic: boolean;
  isBonus: boolean;
  maxPoints: number;
  createdAt: number;
  updatedAt: number;
  deadline?: number | null;
  groupId?: string | null;
  localizedTexts?: ShadowLocalizedText[];
  points?: PointsPayload[];
  permissionHints?: Record<string, boolean>;
}

/** A shadow assignment's own body text, which core-api calls `text` (assignments call it that
 *  too, S-012) rather than `description`. */
interface ShadowLocalizedText extends LocalizedText {
  text?: string;
}

function localizedBody(texts: ShadowLocalizedText[] | undefined, locale: string): string {
  if (!texts?.length) return "";
  const match = texts.find((entry) => entry.locale === locale && entry.text);
  return (match ?? texts.find((entry) => entry.text))?.text ?? "";
}

export const getShadowAssignment = cache(async function getShadowAssignment(
  shadowId: string,
  locale: string,
): Promise<ShadowAssignmentDetail> {
  const [session, assignment] = await Promise.all([
    requireSession(),
    apiRead<ShadowAssignmentPayload>("/v1/shadow-assignments/{id}", {
      pathParams: { id: shadowId },
    }),
  ]);

  const peopleIds = [
    ...new Set(
      (assignment.points ?? [])
        .flatMap((record) => [record.awardeeId, record.authorId])
        .filter((id) => id !== null),
    ),
  ];

  const [group, people] = await Promise.all([
    assignment.groupId
      ? apiRead<{ localizedTexts?: LocalizedText[] }>("/v1/groups/{id}", {
          pathParams: { id: assignment.groupId },
        })
      : Promise.resolve(null),
    peopleIds.length > 0
      ? pageRead(apiPost<{ id: string; fullName: string }[]>("/v1/users/list", { ids: peopleIds }))
      : Promise.resolve([]),
  ]);
  const names = new Map(people.map((person) => [person.id, person.fullName]));

  const points = (assignment.points ?? [])
    .map((record) => ({
      id: record.id,
      points: record.points,
      note: record.note ?? "",
      awardeeId: record.awardeeId ?? null,
      awardeeName: record.awardeeId ? (names.get(record.awardeeId) ?? "") : "",
      authorId: record.authorId ?? null,
      authorName: record.authorId ? (names.get(record.authorId) ?? "") : "",
      createdAt: record.createdAt,
      awardedAt: record.awardedAt ?? null,
    }))
    .sort((a, b) => a.awardeeName.localeCompare(b.awardeeName) || a.createdAt - b.createdAt);

  return {
    id: assignment.id,
    name: localizedName(assignment.localizedTexts, locale),
    text: localizedBody(assignment.localizedTexts, locale),
    version: assignment.version,
    groupId: assignment.groupId ?? null,
    groupName: group ? localizedName(group.localizedTexts, locale) : "",
    maxPoints: assignment.maxPoints,
    isBonus: assignment.isBonus,
    isPublic: assignment.isPublic,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
    deadline: assignment.deadline ?? null,
    points,
    myPoints: points.find((record) => record.awardeeId === session.userId) ?? null,
    can: assignment.permissionHints ?? {},
  };
});

export interface ShadowAssignmentSummary {
  id: string;
  name: string;
  maxPoints: number;
  isBonus: boolean;
  isPublic: boolean;
  deadline: number | null;
  /** The reader's own awarded points, when they have any. */
  myPoints: number | null;
}

/**
 * The group's shadow assignments (S-020), for the same tab that lists the real ones -- the legacy
 * group screen puts both tables there, and a screen nobody can navigate to is not shipped.
 */
export async function getGroupShadowAssignments(
  groupId: string,
  locale: string,
): Promise<ShadowAssignmentSummary[]> {
  const [session, assignments] = await Promise.all([
    requireSession(),
    apiRead<ShadowAssignmentPayload[]>("/v1/groups/{id}/shadow-assignments", {
      pathParams: { id: groupId },
    }),
  ]);

  return assignments
    .map((assignment) => ({
      id: assignment.id,
      name: localizedName(assignment.localizedTexts, locale),
      maxPoints: assignment.maxPoints,
      isBonus: assignment.isBonus,
      isPublic: assignment.isPublic,
      deadline: assignment.deadline ?? null,
      myPoints:
        (assignment.points ?? []).find((record) => record.awardeeId === session.userId)?.points ??
        null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}
