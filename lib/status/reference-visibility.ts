/**
 * How widely a reference solution is shown (T-011).
 *
 * core-api stores this as an integer, and it is a **scale rather than a flag**: a solution can be
 * the author's own working copy, one students may read, or the exercise's canonical answer. Two of
 * those are different claims about the same solution, so reducing them to "public: yes/no" -- which
 * is what a checkbox would do -- loses the one that matters to whoever is looking for the answer.
 *
 * Its own module because both a Server Component and a client one need the numbers, and the read
 * layer that would otherwise hold them is `server-only`.
 */
export const VISIBILITY_TEMPORARY = -1;
export const VISIBILITY_PRIVATE = 0;
export const VISIBILITY_PUBLIC = 1;
export const VISIBILITY_PROMOTED = 2;
