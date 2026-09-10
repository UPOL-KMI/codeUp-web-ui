/**
 * Whether to offer the bytes of a pipeline's supplementary file, as opposed to the row (G-015).
 *
 * Lives here rather than beside the read in `lib/api/pipeline-files.ts` for one plain reason: it
 * is a pure predicate with no server dependency, and that module is `server-only`, which would
 * make this untestable. The read stays there; the rule lives here.
 *
 * **There is no permission hint for this and the real rule cannot be evaluated here**, so this is
 * the narrowest thing that is true rather than a guess. `permissions.neon` grants
 * `uploadedFile.download` on any of six conditions, and a pipeline's supplementary file satisfies
 * exactly one of them for a non-superadmin: `file.isOwner`. The other five are about solutions and
 * about files attached to an **exercise** -- `isAuthorOfFileExercises`,
 * `isExerciseFileInGroupUserSupervises` -- and a pipeline belongs to no group and has no author, so
 * none of them can ever match one of its files.
 *
 * The consequence is worth knowing rather than discovering: **whoever may replace a pipeline's file
 * cannot necessarily download the one they are replacing** (Q-026). A supervisor with `update` on
 * the pipeline is refused the bytes unless they uploaded them, and every seeded file has no
 * uploader at all. core-api decides for real on the call either way; this only decides whether a
 * link is rendered that would 403.
 */
export function canDownloadPipelineFile(
  file: { uploaderId: string | null },
  viewerId: string,
  viewerRole: string,
): boolean {
  return viewerRole === "superadmin" || (file.uploaderId !== null && file.uploaderId === viewerId);
}
