/**
 * The `+5` (or `-3`) that follows a points figure, or nothing when there is no bonus.
 *
 * One spelling, for D-012's reason: the same three lines stood in three places -- the solution
 * page, the attempts list and the class table -- and two more screens were about to get a fourth
 * and fifth copy. A bonus rendered green in one table and plain in another is the failure mode
 * that rule exists to prevent.
 *
 * The leading space is part of it: this always follows a number, never starts a line.
 */
export function BonusPoints({ bonus }: { bonus: number | null | undefined }) {
  if (bonus === null || bonus === undefined || bonus === 0) return null;
  return (
    <span className={bonus > 0 ? "text-success" : "text-destructive"}>
      {bonus > 0 ? ` +${bonus}` : ` ${bonus}`}
    </span>
  );
}
