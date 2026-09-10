import * as z from "zod/mini";

/**
 * What the limits screen sends (T-010). Numbers travel as the strings they were typed as and are
 * converted once, in the action -- a grid of `<input type="number">` produces empty strings for
 * cleared cells, and `Number("")` is a silent zero that core-api would then refuse with a message
 * about a cell the reader cannot find.
 */
export const hardwareGroupsSchema = z.object({
  hardwareGroups: z.array(z.string()),
});

export type HardwareGroupsValues = z.infer<typeof hardwareGroupsSchema>;

export const limitsSchema = z.object({
  hardwareGroupId: z.string().check(z.minLength(1)),
  preciseTime: z.boolean(),
  cells: z.record(
    z.string(),
    z.record(z.string(), z.object({ memory: z.string(), time: z.string() })),
  ),
});

export type LimitsFormValues = z.infer<typeof limitsSchema>;
