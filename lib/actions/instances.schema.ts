import * as z from "zod/mini";
import { fromDateTimeLocal } from "@/lib/format/datetime-local";

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
  name: z.string().check(z.trim(), z.minLength(2, "tooShort")),
  description: z.string().check(z.trim()),
  isOpen: z.boolean(),
});

export type CreateInstanceValues = z.infer<typeof createInstanceSchema>;

export const licenceFormSchema = z.object({
  note: z.string().check(z.trim(), z.minLength(2, "tooShort"), z.maxLength(255, "tooLong")),
  /** `datetime-local`, as the picker speaks it. */
  validUntil: z.string().check(z.minLength(1, "required")),
});

export type LicenceFormValues = z.infer<typeof licenceFormSchema>;

/** The same licence as core-api takes it: `validUntil` in unix seconds. */
export const licenceSchema = z.object({
  note: z.string().check(z.trim(), z.minLength(2, "tooShort"), z.maxLength(255, "tooLong")),
  validUntil: z.number().check(z.int()),
});

export type LicenceValues = z.infer<typeof licenceSchema>;

/** Resolved in the browser, the only clock that knows what the reader typed. */
export function licenceFormToValues(values: LicenceFormValues): LicenceValues | null {
  const validUntil = fromDateTimeLocal(values.validUntil);
  return validUntil === null ? null : { note: values.note, validUntil };
}
