import { streamFromCoreApi } from "@/lib/http/stream-download";

/**
 * Every student's best attempt at one assignment, as the archive core-api builds (G-006) -- how a
 * teacher takes a class's work offline to read on a train.
 *
 * **core-api gates the endpoint on the assignment's `canViewDetail`, which a student has for their
 * own assignment, and then filters the archive's *contents* per student** (`canViewSubmissions`
 * plus each solution's own `canViewDetail`, read from `actionDownloadBestSolutionsArchive`). So the
 * refusal a student would meet is not a 403 but an archive holding only their own work -- which is
 * why the link is offered on `viewAssignmentSolutions`, the hint that means "may read other
 * people's attempts", rather than on whatever would merely make the request succeed.
 *
 * The 202-with-JSON trap `streamFromCoreApi` exists for applies here too: an assignment whose
 * group has been deleted answers `NotFoundException`, and a `response.ok` check would have handed
 * the browser a .zip containing that sentence.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const { assignmentId } = await params;
  return streamFromCoreApi(
    `/exercise-assignments/${encodeURIComponent(assignmentId)}/download-best-solutions`,
    `best-solutions-${assignmentId}.zip`,
  );
}
