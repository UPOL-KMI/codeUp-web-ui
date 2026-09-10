"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";

/**
 * The agreement to have one's personal data processed, asked before an account is created
 * (G-026).
 *
 * **One component rather than one per form, because the sentence is a legal statement.** It is
 * asked in the two places this app can create an account -- the registration form (A-003) and the
 * invitation the email leads to (S-024) -- and two copies of a sentence like this are two things
 * to keep in step when whoever runs the deployment rewords it. The legacy app has it on the
 * registration form only; that it belongs on both is DEC-129.
 *
 * **It is not sent anywhere**, which is the same in the legacy app: core-api has no field for it
 * (`RegistrationPresenter` reads none, and no `gdpr` appears anywhere in its source), so this is a
 * gate in front of the request rather than a record of consent. Worth stating plainly, because a
 * tick that looks like it is stored and is not is the kind of thing an audit asks about later.
 *
 * The refusal is rendered beside the control rather than in the form's own alert at the top: it is
 * about this field, and a reader who has just tried to submit is looking at the button, not at the
 * top of the page.
 */
export function ConsentCheckbox({
  checked,
  onChange,
  error = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: boolean;
}) {
  const t = useTranslations("Consent");
  const errorId = useId();

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4 shrink-0"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-invalid={error || undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <span>{t("agree")}</span>
      </label>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {t("required")}
        </p>
      )}
    </div>
  );
}
