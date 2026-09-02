"use client";

import { useState } from "react";
import { FormProvider } from "react-hook-form";
import { useTranslations } from "next-intl";

import {
  changePassword,
  createCalendarToken,
  expireCalendarToken,
  updateProfile,
  updateSettings,
} from "@/lib/actions/account";
import {
  passwordSchema,
  profileSchema,
  type PasswordValues,
  type ProfileValues,
} from "@/lib/actions/account.schema";
import type { AccountSettings, CalendarToken, NotificationFlag } from "@/lib/api/user-settings";
import { useServerActionForm } from "@/lib/forms/use-server-action-form";
import type { ActionResult } from "@/lib/forms/action-result";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { Field } from "@/components/form/field";
import { useToast } from "@/components/toast/toast-provider";

/**
 * Editing one's own account (S-022): who you are, how you sign in, what ReCodEx emails you, and
 * the calendar tokens that let something else read your deadlines.
 *
 * Four separate submits, not one, because they fail and succeed independently -- and because
 * **changing the password ends the session**: core-api invalidates every token this user holds
 * (`changeUserPassword` sets a validity threshold), so the page signs out immediately afterwards
 * rather than leaving the reader on a screen whose next click would 401. Folding that into a form
 * that also saves a display name would mean losing the session for changing "Jan" to "Honza".
 */
const input =
  "rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring aria-invalid:border-destructive";
const primary =
  "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60 aria-disabled:opacity-60";
const secondary =
  "rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60";

export function ProfileForm({ account }: { account: AccountSettings }) {
  const t = useTranslations("Account.profile");
  const router = useRouter();
  const toast = useToast();

  const { form, onSubmit, isPending } = useServerActionForm<ProfileValues, { userId: string }>({
    schema: profileSchema,
    defaultValues: {
      titlesBeforeName: account.titlesBeforeName,
      firstName: account.firstName,
      lastName: account.lastName,
      titlesAfterName: account.titlesAfterName,
      email: account.email,
      gravatarUrlEnabled: account.gravatarUrlEnabled,
    },
    action: (values) => updateProfile(account.id, values),
    onSuccess: () => {
      toast.success(t("saved"));
      router.refresh();
    },
  });

  const {
    register,
    formState: { errors },
  } = form;

  return (
    <FormProvider {...form}>
      <form
        onSubmit={(event) => {
          if (isPending) {
            event.preventDefault();
            return;
          }
          void onSubmit(event);
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("titlesBeforeName")}>
            <input type="text" className={input} {...register("titlesBeforeName")} />
          </Field>
          <Field label={t("titlesAfterName")}>
            <input type="text" className={input} {...register("titlesAfterName")} />
          </Field>
          <Field label={t("firstName")} error={errors.firstName && t("errors.tooShort")}>
            <input
              type="text"
              aria-invalid={errors.firstName ? true : undefined}
              className={input}
              {...register("firstName")}
            />
          </Field>
          <Field label={t("lastName")} error={errors.lastName && t("errors.tooShort")}>
            <input
              type="text"
              aria-invalid={errors.lastName ? true : undefined}
              className={input}
              {...register("lastName")}
            />
          </Field>
        </div>

        <Field
          label={t("email")}
          error={errors.email && t("errors.invalidEmail")}
          description={t("emailHint")}
        >
          <input
            type="email"
            autoComplete="email"
            aria-invalid={errors.email ? true : undefined}
            className={input}
            {...register("email")}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" {...register("gravatarUrlEnabled")} />
          {t("gravatar")}
        </label>

        {errors.root?.message && (
          <p role="alert" className="text-sm text-destructive">
            {errors.root.message}
          </p>
        )}

        <div>
          <button type="submit" aria-disabled={isPending} className={primary}>
            {isPending ? t("saving") : t("save")}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}

export function PasswordForm({ account }: { account: AccountSettings }) {
  const t = useTranslations("Account.password");
  const router = useRouter();
  const toast = useToast();

  const { form, onSubmit, isPending } = useServerActionForm<PasswordValues, { userId: string }>({
    schema: passwordSchema,
    defaultValues: { oldPassword: "", password: "", passwordConfirm: "" },
    action: (values) => changePassword(account.id, values),
    onSuccess: async () => {
      toast.success(t("changed"));
      // The token that made that request is already dead: core-api invalidates every token on a
      // password change. Signing out is the honest next step, and it is this app's own BFF route
      // that clears the cookie.
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    },
  });

  const {
    register,
    formState: { errors },
  } = form;

  return (
    <FormProvider {...form}>
      <form
        onSubmit={(event) => {
          if (isPending) {
            event.preventDefault();
            return;
          }
          void onSubmit(event);
        }}
        className="flex flex-col gap-4"
      >
        <p className="text-sm text-muted-foreground">{t("signsYouOut")}</p>
        {!account.emptyLocalPassword && (
          <Field label={t("oldPassword")}>
            <input
              type="password"
              autoComplete="current-password"
              className={input}
              {...register("oldPassword")}
            />
          </Field>
        )}
        <Field label={t("newPassword")} error={errors.password && t("errors.required")}>
          <input
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.password ? true : undefined}
            className={input}
            {...register("password")}
          />
        </Field>
        <Field label={t("confirmPassword")} error={errors.passwordConfirm && t("errors.mismatch")}>
          <input
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.passwordConfirm ? true : undefined}
            className={input}
            {...register("passwordConfirm")}
          />
        </Field>

        {errors.root?.message && (
          <p role="alert" className="text-sm text-destructive">
            {errors.root.message}
          </p>
        )}

        <div>
          <button type="submit" aria-disabled={isPending} className={primary}>
            {isPending ? t("saving") : t("save")}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}

export function SettingsForm({
  account,
  locales,
  flags,
}: {
  account: AccountSettings;
  locales: readonly string[];
  flags: readonly NotificationFlag[];
}) {
  const t = useTranslations("Account.settings");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState({
    defaultLanguage: account.settings.defaultLanguage,
    flags: Object.fromEntries(
      flags.map((flag) => [flag, account.settings[flag] === true]),
    ) as Record<string, boolean>,
  });

  async function save() {
    setPending(true);
    const result: ActionResult<unknown> = await updateSettings(account.id, draft);
    setPending(false);
    if (result.success) {
      toast.success(t("saved"));
      router.refresh();
    } else {
      toast.error(t("failed"), result.formError);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label={t("defaultLanguage")} description={t("defaultLanguageHint")}>
        <select
          value={draft.defaultLanguage}
          onChange={(event) =>
            setDraft((current) => ({ ...current, defaultLanguage: event.target.value }))
          }
          className={input}
        >
          {locales.map((locale) => (
            <option key={locale} value={locale}>
              {t(`languages.${locale}`)}
            </option>
          ))}
        </select>
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t("emails")}</legend>
        {flags.map((flag) => (
          <label key={flag} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4"
              checked={draft.flags[flag] === true}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  flags: { ...current.flags, [flag]: event.target.checked },
                }))
              }
            />
            {t(`flags.${flag}`)}
          </label>
        ))}
      </fieldset>

      <div>
        <button type="button" disabled={pending} className={primary} onClick={() => void save()}>
          {t("save")}
        </button>
      </div>
    </div>
  );
}

export function CalendarTokens({
  userId,
  tokens,
  apiBase,
}: {
  userId: string;
  tokens: CalendarToken[];
  /** The **public** API base, since this URL is for a calendar app to fetch, not for this server. */
  apiBase: string;
}) {
  const t = useTranslations("Account.calendars");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [expiring, setExpiring] = useState<string | null>(null);

  async function run(call: () => Promise<ActionResult<unknown>>, successKey: string) {
    setPending(true);
    const result = await call();
    setPending(false);
    setExpiring(null);
    if (result.success) {
      toast.success(t(successKey));
      router.refresh();
    } else {
      toast.error(t("failed"), result.formError);
    }
  }

  const live = tokens.filter((token) => token.expiredAt === null);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("explain")}</p>

      {tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tokens.map((token) => (
            <li
              key={token.id}
              className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <code className="truncate text-xs">{`${apiBase}/users/ical/${token.id}`}</code>
                {token.expiredAt === null ? (
                  <button
                    type="button"
                    disabled={pending}
                    className={secondary}
                    onClick={() => setExpiring(token.id)}
                  >
                    {t("expire")}
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">{t("expired")}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div>
        <button
          type="button"
          disabled={pending}
          className={primary}
          onClick={() => void run(() => createCalendarToken(userId), "created")}
        >
          {live.length === 0 ? t("create") : t("createAnother")}
        </button>
      </div>

      <ConfirmDialog
        open={expiring !== null}
        onOpenChange={(open) => !open && setExpiring(null)}
        title={t("confirmExpire.title")}
        description={t("confirmExpire.description")}
        pending={pending}
        onConfirm={() => {
          if (expiring) void run(() => expireCalendarToken(expiring), "expired");
        }}
      />
    </div>
  );
}
