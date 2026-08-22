import { Link } from "@/i18n/navigation";
import { DateTime } from "@/components/format/date-time";
import { RelativeTime } from "@/components/format/relative-time";
import type { ReviewQueueItem } from "@/lib/api/dashboard";

/**
 * A queue of solutions waiting on a teacher (S-002), oldest first -- used for both "reviews you
 * have opened and not finished" and "reviews students have asked for". One component for both,
 * because they differ only in what the timestamp means, and the caller names that in the column
 * header rather than this table guessing.
 *
 * Oldest first is not a default, it is the requirement: `docs/IA.md` §4.1 asks for unreviewed
 * submissions "sorted by waiting time", and a teacher opening this panel needs the person who has
 * been waiting longest, not the most recent arrival.
 *
 * No "close review" action here, deliberately: closing a review from a list, without having read
 * the solution, is a click that should not be one keystroke away. The row links to the solution,
 * where S-018 builds the review itself.
 */
export function ReviewQueue({
  items,
  columns,
}: {
  items: ReviewQueueItem[];
  columns: { student: string; assignment: string; group: string; since: string };
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-3 py-2 text-left font-medium">{columns.student}</th>
            <th className="px-3 py-2 text-left font-medium">{columns.assignment}</th>
            <th className="px-3 py-2 text-left font-medium">{columns.group}</th>
            <th className="px-3 py-2 text-left font-medium">{columns.since}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.solutionId}
              className="border-b border-border last:border-0 hover:bg-muted/30"
            >
              <td className="px-3 py-2">
                <Link
                  href={`/solutions/${item.solutionId}`}
                  className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {item.authorName}
                </Link>
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/assignments/${item.assignmentId}`}
                  className="text-muted-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {item.assignmentName}
                </Link>
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {item.groupId ? (
                  <Link
                    href={`/groups/${item.groupId}`}
                    className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {item.groupName}
                  </Link>
                ) : (
                  item.groupName
                )}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <DateTime unixSeconds={item.since} />
                  <span className="text-muted-foreground">
                    <RelativeTime unixSeconds={item.since} />
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
