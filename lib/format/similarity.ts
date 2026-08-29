/**
 * A detection tool's similarity, as a percentage (S-019).
 *
 * core-api clamps what a tool uploads to [0, 1] (`actionAddSimilarities`), so this only has to
 * turn a ratio into something readable -- rounded to whole percent, because a tool reporting
 * 0.8734 is not claiming that third digit means anything.
 */
export function formatSimilarity(similarity: number): string {
  return `${Math.round(Math.max(0, Math.min(1, similarity)) * 100)} %`;
}
