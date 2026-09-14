/**
 * Who teaches a group, out of what `GET /v1/groups/{id}` says.
 *
 * Used to mark a teacher's voice in a discussion (T-022): a student reading a thread cannot
 * otherwise tell an answer from a classmate's guess, which was the operator's complaint.
 *
 * `admins` and `supervisors` live in `privateData`, behind `canViewDetail` -- a member of the
 * group has that, so a student reading their own course's discussion does get the list. Where the
 * reader is outside the group, `privateData` is null and this returns the primary admins alone,
 * which is public. Observers are deliberately not here: they watch a group, they do not teach it.
 */
export interface GroupTeacherSource {
  primaryAdminsIds?: string[];
  privateData?: { admins?: string[]; supervisors?: string[] } | null;
}

export function groupTeacherIds(group: GroupTeacherSource | null | undefined): string[] {
  if (!group) return [];
  return [
    ...new Set([
      ...(group.primaryAdminsIds ?? []),
      ...(group.privateData?.admins ?? []),
      ...(group.privateData?.supervisors ?? []),
    ]),
  ];
}
