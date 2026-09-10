/**
 * A `mailto:` link over a whole group of people (G-011).
 *
 * **Blind carbon copy, not To**, which is the legacy app's own choice and the only defensible one:
 * a class of thirty in the `To` field hands every student every other student's address, and in
 * most jurisdictions that is a personal-data disclosure nobody asked for.
 *
 * The addresses are percent-encoded individually and joined with commas, exactly as the legacy
 * `GroupNavigation` builds them -- the comma is the separator `mailto:` defines, so it stays
 * literal while anything inside an address does not.
 *
 * **A long recipient list is the trap this function exists for.** There is no limit in the
 * `mailto:` specification, but there is one in nearly every implementation that opens the link:
 * Windows' shell handler and several desktop clients stop reading at around two thousand
 * characters, and they **truncate rather than refuse** -- so a teacher pressing this on a large
 * course gets a composer holding some of their class and no indication that the rest fell off.
 * That is a silent wrong answer, so the ceiling is reported and the caller says so in words. The
 * number is a conservative real-world figure rather than a specified one, which is why it is named
 * here rather than buried in a comparison.
 */
const SAFE_URL_LENGTH = 2000;

export interface GroupMailto {
  /** The link itself, or null when not one address was disclosed. */
  href: string | null;
  /** The addresses actually in the `bcc` field. */
  addresses: string[];
  /** People on the roster whose address core-api did not disclose to this reader. */
  undisclosed: number;
  /** The link is long enough that a mail client may silently truncate it. */
  mayTruncate: boolean;
}

export function groupMailto(people: readonly { email: string | null }[]): GroupMailto {
  // A duplicate address would be a duplicate recipient. core-api keys accounts on the address, so
  // this should not happen -- and de-duplicating costs one pass, where finding out it can happen
  // costs a teacher an apology.
  const addresses = [
    ...new Set(
      people.map((person) => person.email).filter((email): email is string => Boolean(email)),
    ),
  ];

  if (addresses.length === 0) {
    return { href: null, addresses: [], undisclosed: people.length, mayTruncate: false };
  }

  const href = `mailto:?bcc=${addresses.map(encodeURIComponent).join(",")}`;

  return {
    href,
    addresses,
    undisclosed: people.length - addresses.length,
    mayTruncate: href.length > SAFE_URL_LENGTH,
  };
}
