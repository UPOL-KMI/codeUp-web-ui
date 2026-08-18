/**
 * The return contract every Server Action in the form kit uses (brief §5/§6: every Server Action
 * re-validates with Zod and is itself the real authorisation boundary -- its errors are the ones
 * that matter, client-side Zod validation is just a head start). `fieldErrors` keys are field
 * *names* as `useForm`'s `DefaultValues` would use them (including dotted paths for nested
 * fields, e.g. `"name.first"`), mapped back onto the form via `useServerActionForm`'s
 * `form.setError()` calls -- see `use-server-action-form.ts`.
 */
export interface ActionSuccess<T> {
  success: true;
  data: T;
}

export interface ActionFailure {
  success: false;
  /** Shown as a form-level error (RHF's `root` pseudo-field), not tied to one input. */
  formError?: string;
  fieldErrors?: Record<string, string>;
}

export type ActionResult<T> = ActionSuccess<T> | ActionFailure;
