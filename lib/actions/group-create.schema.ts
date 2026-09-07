import { z } from "zod";

import { groupTextSchema } from "./group-settings.schema";

/**
 * A new group, as the dialog collects it and as the Server Action re-validates it (G-008).
 *
 * Deliberately much smaller than core-api's `addGroup` body, which also accepts visibility, the
 * two pass rules, the organizational and exam flags and `noAdmin`. DEC-093's shape applies here as
 * it does to a new assignment: create with core-api's defaults, then land on the settings tab that
 * already edits every one of those. A wizard would be a second copy of S-009's form, and a group
 * half-created in a closed tab would be worse than one created plain.
 *
 * The name rule is `groupSettingsSchema`'s, reused rather than restated: core-api looks a group up
 * by name per locale, a locale left blank is dropped rather than saved empty, and at least one has
 * to survive or the group would be unnameable.
 */
export const createGroupSchema = z
  .object({
    texts: z.array(groupTextSchema).min(1),
  })
  .superRefine((values, ctx) => {
    if (!values.texts.some((text) => text.name.trim() !== "")) {
      ctx.addIssue({ code: "custom", path: ["texts"], message: "nameRequired" });
    }
  });

export type CreateGroupValues = z.infer<typeof createGroupSchema>;
