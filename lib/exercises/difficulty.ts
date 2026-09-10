/**
 * The three difficulties core-api documents as a string and this app refuses to widen (T-008).
 *
 * **Its own module rather than a constant on `exercise.schema.ts`, and PF-004 is why.** A schema
 * module pulls Zod's whole runtime in with it, and a `"use client"` form importing one *value*
 * from such a module anchors 52 kB of it in that route's initial chunk group -- however carefully
 * the schema itself is loaded on demand. The same reasoning `lib/api/user-roles.ts` records for
 * `server-only`: a list that both sides need is vocabulary, and vocabulary belongs in a module
 * that costs nothing to import.
 */
export const DIFFICULTIES = ["easy", "medium", "hard"] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];
