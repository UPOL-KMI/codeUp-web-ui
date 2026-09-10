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
    /** `datetime-local` value, or empty for a link that never expires. */
    expiresAt: z.string(),
  })
  .check(
    z.superRefine((values, ctx) => {
      if (values.expiresAt === "") return;
      const parsed = Date.parse(values.expiresAt);
      if (Number.isNaN(parsed)) {
        ctx.addIssue({ code: "custom", path: ["expiresAt"], message: "invalidDate" });
        return;
      }
      if (parsed <= Date.now()) {
        ctx.addIssue({ code: "custom", path: ["expiresAt"], message: "pastDate" });
      }
    }),
  );

export type InvitationValues = z.infer<typeof invitationSchema>;
