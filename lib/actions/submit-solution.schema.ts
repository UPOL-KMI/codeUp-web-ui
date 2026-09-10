import * as z from "zod/mini";

/**
 * The submit form's shape, shared by the client form and the Server Action that re-validates it
 * (brief §6: "A Server Action is a public HTTP endpoint that happens to have nice syntax").
 *
 * **Deliberately in its own file, apart from the `"use server"` module.** A `"use server"` file
 * may export only async functions; a schema exported from one fails at build time -- the form
 * kit's own doc comment records this from D-004, and this is the first real consumer to hit it.
 *
 * `note` is capped at 1024 characters because that is what core-api's own `VString(0, 1024)`
 * accepts; a longer one is rejected by the API, so catching it here turns a failed submission into
 * an inline message.
 */
export const submitSolutionSchema = z.object({
  files: z.array(z.uuid()).check(z.minLength(1)),
  runtimeEnvironmentId: z.string().check(z.minLength(1)),
  note: z.string().check(z.maxLength(1024)),
});

export type SubmitSolutionValues = z.infer<typeof submitSolutionSchema>;
