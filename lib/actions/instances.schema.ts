import { z } from "zod";

/**
 * What an administrator types about an instance and its licences (AD-004/AD-008). Its own module
 * apart from the `"use server"` file (D-004).
 *
 * The rules are core-api's, restated: a name of at least two characters (`VString(2)`), a licence
 * note likewise, and an expiry that is a real date. **The expiry is a `datetime-local` string
 * here and unix seconds on the wire** -- the same conversion S-008's exam windows make, and for
 * the same reason: the picker speaks the reader's own wall clock, and reinterpreting it anywhere
 * else moves the date.
 */
export const createInstanceSchema = z.object({
  name: z.string().trim().min(2, "tooShort"),
  description: z.string().trim(),
  isOpen: z.boolean(),
});

export type CreateInstanceValues = z.infer<typeof createInstanceSchema>;

export const licenceSchema = z.object({
  note: z.string().trim().min(2, "tooShort").max(255, "tooLong"),
  /** `datetime-local`, converted to unix seconds by the action. */
  validUntil: z.string().min(1, "required"),
});

export type LicenceValues = z.infer<typeof licenceSchema>;
