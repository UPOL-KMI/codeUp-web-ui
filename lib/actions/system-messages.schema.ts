import * as z from "zod/mini";

import { USER_ROLES } from "@/lib/api/user-roles";
import { fromDateTimeLocal } from "@/lib/format/datetime-local";

/**
 * A broadcast, as the editor collects it and the Server Action re-validates it (AD-007). Its own
 * module apart from the `"use server"` file (D-004).
 *
 * core-api requires **every** field on both create and update -- the update endpoint takes the same
 * body as create and replaces the message, it does not patch -- so nothing here is optional.
 *
 * Two shapes, the same way S-008's exam window has two: the **form** collects `datetime-local`
 * strings, and the **payload** the action re-validates carries unix seconds. They are kept apart
 * rather than converted in the action because that conversion reads a wall clock, and the server's
 * is not the reader's -- a container running UTC would move every window by the offset.
 *
 * A message needs text in at least one language: core-api refuses an empty `localizedTexts`, and a
 * message with none would be an invisible broadcast. The locale a reader does not have falls back
 * the way every other localized text in this app does.
 */
const messageTextSchema = z.object({
  locale: z.string().check(z.minLength(2)),
  text: z.string(),
});

export const systemMessageFormSchema = z
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

export type SystemMessageFormValues = z.infer<typeof systemMessageFormSchema>;

/**
 * The same message as core-api takes it: the window in unix seconds. The two rules the form states
 * are restated here rather than trusted, because a Server Action is a public endpoint whatever the
 * form did (brief §6).
 */
export const systemMessageSchema = z
  .object({
    texts: z.array(messageTextSchema).check(z.minLength(1)),
    type: z.enum(["success", "info", "warning", "danger"]),
    role: z.enum(USER_ROLES),
    visibleFrom: z.number().check(z.int()),
    visibleTo: z.number().check(z.int()),
  })
  .check(
    z.superRefine((values, ctx) => {
      if (!values.texts.some((text) => text.text.trim() !== "")) {
        ctx.addIssue({ code: "custom", path: ["texts"], message: "textRequired" });
      }
      if (values.visibleTo <= values.visibleFrom) {
        ctx.addIssue({ code: "custom", path: ["visibleTo"], message: "endsBeforeItStarts" });
      }
    }),
  );

export type SystemMessageValues = z.infer<typeof systemMessageSchema>;

/**
 * Resolved in the browser, which is the only clock that knows what the reader typed
 * (`lib/format/datetime-local.ts`). A window that will not parse becomes `null`, which the form's
 * own validation has already refused.
 */
export function systemMessageFormToValues(
  values: SystemMessageFormValues,
): SystemMessageValues | null {
  const visibleFrom = fromDateTimeLocal(values.visibleFrom);
  const visibleTo = fromDateTimeLocal(values.visibleTo);
  if (visibleFrom === null || visibleTo === null) return null;
  return { texts: values.texts, type: values.type, role: values.role, visibleFrom, visibleTo };
}
