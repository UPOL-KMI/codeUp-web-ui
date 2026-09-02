import { z } from "zod";

/**
 * A new account, as an administrator fills it in from the user list (AD-001). Its own module apart
 * from the `"use server"` file (D-004), so the form and the action that re-validates it share one
 * definition.
 *
 * The rules are core-api's `RegistrationPresenter::actionCreateAccount`, restated: both names at
 * least two characters (`VString(2)`), a real email, and the password typed twice -- core-api
 * compares them itself and answers `400-102` when they differ, which is a round trip to learn
 * something the form already knows.
 */
export const createUserSchema = z
  .object({
    firstName: z.string().trim().min(2, "tooShort"),
    lastName: z.string().trim().min(2, "tooShort"),
    email: z.string().trim().email("invalidEmail"),
    password: z.string().min(1, "required"),
    passwordConfirm: z.string().min(1, "required"),
    /** Sent on the second attempt, once the administrator has seen who else has that name. */
    ignoreNameCollision: z.boolean(),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "mismatch",
  });

export type CreateUserValues = z.infer<typeof createUserSchema>;
