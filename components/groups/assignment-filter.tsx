import { Link } from "@/i18n/navigation";
import type { AssignmentFilter } from "@/lib/api/group-detail";

/**
 * The assignment list's filter (S-006), as links rather than a control: the filter is applied
 * server-side and lives in the URL, so each option is a real, shareable address, needs no
 * JavaScript, and the back button steps through the reader's choices.
 *
 * `docs/IA.md`'s ticket note asks for "all, open, closed, w/ submissions". The last only means
 * anything to someone who studies in this group, so it is offered only to them -- a supervisor
 * filtering by "my submissions" would be filtering by an empty set.
 */
export function AssignmentFilterNav({
  groupId,
  current,
  options,
  labels,
}: {
  groupId: string;
  current: AssignmentFilter;
  options: AssignmentFilter[];
  labels: Record<AssignmentFilter, string>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option === current;
        return (
          <Link
            key={option}
            href={`/groups/${groupId}?tab=assignments&filter=${option}`}
            aria-current={active ? "true" : undefined}
            className={`rounded-full px-3 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
              active
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {labels[option]}
          </Link>
        );
      })}
    </div>
  );
}
