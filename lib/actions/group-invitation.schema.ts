import * as z from "zod/mini";

/**
 * An invitation link, as the form collects it (T-018). Its own module apart from the
 * `"use server"` file, per D-004's rule.
 *
 * core-api takes `expireAt` and `note` and validates neither beyond their types -- a null
 * `expireAt` is a link that never expires, which is a real and useful thing for a course that runs
 * all term. What this schema adds is the one rule core-api does not have and a person still wants:
 * a date already in the past would mint a link that is dead on arrival.
 */
export const invitationSchema = z
  .object({
    note: z.string().check(z.trim(), z.maxLength(1024)),
    /**
     * Unix seconds, or null for a link that never expires. The picker's wall-clock string is
     * resolved in the browser (`lib/format/datetime-local.ts`) -- comparing two absolute instants
     * here is zone-free, reading a wall clock here would not be.
     */
    expiresAt: z.nullable(z.number().check(z.int())),
  })
  .check(
    z.superRefine((values, ctx) => {
      if (values.expiresAt === null) return;
      if (values.expiresAt * 1000 <= Date.now()) {
        ctx.addIssue({ code: "custom", path: ["expiresAt"], message: "pastDate" });
      }
    }),
  );

export type InvitationValues = z.infer<typeof invitationSchema>;
