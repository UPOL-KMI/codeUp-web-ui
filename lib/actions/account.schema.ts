import { z } from "zod";

import { DATE_FORMAT_LOCALES, DEFAULT_PAGES } from "@/lib/api/ui-preferences";

/**
 * The reader's own account, as the settings forms collect it (S-022). Shared with the Server
 * Actions that re-validate it, in its own module apart from the `"use server"` file (D-004).
 *
 * The rules are core-api's, restated so a mistake is answered in the form: names are at least two
 * characters (`VString(2)`), the email must be an email, and a new password must be typed twice --
 * core-api compares them itself and answers `400-102` when they differ, which is a round trip to
 * learn something the form already knows.
 */
export const profileSchema = z.object({
  titlesBeforeName: z.string().trim().max(64),
  firstName: z.string().trim().min(2, "tooShort"),
  lastName: z.string().trim().min(2, "tooShort"),
  titlesAfterName: z.string().trim().max(64),
  email: z.string().trim().email("invalidEmail"),
  gravatarUrlEnabled: z.boolean(),
});

export type ProfileValues = z.infer<typeof profileSchema>;

export const passwordSchema = z
  .object({
    /** Empty is allowed only for an account whose local password has never been set. */
    oldPassword: z.string(),
    password: z.string().min(1, "required"),
    passwordConfirm: z.string().min(1, "required"),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "mismatch",
  });

export type PasswordValues = z.infer<typeof passwordSchema>;

export const settingsSchema = z.object({
  defaultLanguage: z.string().min(2),
  flags: z.record(z.string(), z.boolean()),
});

export type SettingsValues = z.infer<typeof settingsSchema>;

/**
 * The two interface preferences (G-022). Both may be empty, which is the stored "follow the
 * default" -- so this schema has nothing that can fail, and exists for the same reason the others
 * do: the Server Action re-validates what the form sends rather than trusting it.
 */
export const interfacePreferencesSchema = z.object({
  defaultPage: z.enum(DEFAULT_PAGES),
  /** Empty means "follow the interface language". */
  dateFormatOverride: z.union([z.enum(DATE_FORMAT_LOCALES), z.literal("")]),
});

export type InterfacePreferencesValues = z.infer<typeof interfacePreferencesSchema>;
