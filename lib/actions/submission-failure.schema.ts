import { z } from "zod";

/**
 * Resolving a submission failure (T-019), shared by the dialog and the Server Action that
 * re-validates it. Its own module, apart from the `"use server"` file, per D-004's rule.
 *
 * 255 characters because that is core-api's own `VString(0, 255)` on the field -- validated here
 * so the reader is told before the round trip, not instead of it.
 */
export const resolveFailureSchema = z.object({
  note: z.string().trim().max(255),
  sendEmail: z.boolean(),
});

export type ResolveFailureValues = z.infer<typeof resolveFailureSchema>;
