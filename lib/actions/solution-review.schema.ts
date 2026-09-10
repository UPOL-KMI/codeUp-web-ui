import * as z from "zod/mini";

/**
 * A review comment's editable fields, shared by the client form and the Server Action that
 * re-validates them (S-018). In its own module, apart from the `"use server"` file, for the reason
 * D-004 recorded and S-014 hit first: a `"use server"` module may export only async functions.
 *
 * `text` is capped at 65535 characters because that is core-api's own `VString(1, 65535)`, and
 * trimmed before the length check because core-api trims too and then rejects an empty comment --
 * so a comment of nothing but spaces has to fail here, with a message, rather than there.
 */
export const reviewCommentSchema = z.object({
  text: z.string().check(z.trim(), z.minLength(1), z.maxLength(65535)),
  /** Issues are the comments the student is expected to resolve; core-api counts them on close. */
  issue: z.boolean(),
  /** Only has an effect on an already-closed review, where an edit would otherwise email the author. */
  suppressNotification: z.boolean(),
});

export type ReviewCommentValues = z.infer<typeof reviewCommentSchema>;
