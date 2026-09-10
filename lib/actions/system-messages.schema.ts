import * as z from "zod/mini";

import { USER_ROLES } from "@/lib/api/user-roles";

/**
 * A broadcast, as the editor collects it and the Server Action re-validates it (AD-007). Its own
 * module apart from the `"use server"` file (D-004).
 *
 * core-api requires **every** field on both create and update -- the update endpoint takes the same
 * body as create and replaces the message, it does not patch -- so nothing here is optional. The
 * two dates are `datetime-local` strings converted to unix seconds by the action, the same way
 * S-008's exam windows are (`lib/format/datetime-local.ts`).
 *
 * A message needs text in at least one language: core-api refuses an empty `localizedTexts`, and a
 * message with none would be an invisible broadcast. The locale a reader does not have falls back
 * the way every other localized text in this app does.
 */
const messageTextSchema = z.object({
  locale: z.string().check(z.minLength(2)),
  text: z.string(),
});

export const systemMessageSchema = z
  .object({
    texts: z.array(messageTextSchema).check(z.minLength(1)),
    type: z.enum(["success", "info", "warning", "danger"]),
    role: z.enum(USER_ROLES),
    visibleFrom: z.string().check(z.minLength(1, "required")),
    visibleTo: z.string().check(z.minLength(1, "required")),
  })
  .check(
    z.superRefine((values, ctx) => {
      if (!values.texts.some((text) => text.text.trim() !== "")) {
        ctx.addIssue({ code: "custom", path: ["texts"], message: "textRequired" });
      }
      if (values.visibleFrom && values.visibleTo && values.visibleTo <= values.visibleFrom) {
        ctx.addIssue({ code: "custom", path: ["visibleTo"], message: "endsBeforeItStarts" });
      }
    }),
  );

export type SystemMessageValues = z.infer<typeof systemMessageSchema>;
