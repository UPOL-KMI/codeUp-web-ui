"use client";

import { useState } from "react";
import { FormProvider } from "react-hook-form";
import { useTranslations } from "next-intl";

import {
  changePassword,
  createCalendarToken,
  expireCalendarToken,
  updateInterfacePreferences,
  updateProfile,
  updateSettings,
} from "@/lib/actions/account";
import {
  passwordSchema,
  profileSchema,
  type InterfacePreferencesValues,
  type PasswordValues,
  type ProfileValues,
} from "@/lib/actions/account.schema";
import { invalidateUserTokens } from "@/lib/actions/users";
import type { AccountSettings, CalendarToken, NotificationFlag } from "@/lib/api/user-settings";
import {
  DATE_FORMAT_LOCALES,
  DEFAULT_PAGES,
  type DateFormatLocale,
  type DefaultPage,
} from "@/lib/api/ui-preferences";
import {
  restrictedTokenRequest,
  TOKEN_EXPIRATIONS,
  type RestrictedTokenChoice,
  type TokenScope,
} from "@/lib/auth/restricted-token";
import { useApiErrorMessage, type ApiErrorBody } from "@/lib/api/use-api-error-message";
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
  teacherFlags = [],
}: {
  account: AccountSettings;
  locales: readonly string[];
  flags: readonly NotificationFlag[];
  /**
   * The flags whose e-mails only reach somebody who teaches, empty for a reader who does not.
   * Kept a separate list rather than a `disabled` state: a setting that can never do anything is
   * not worth explaining to a student, and four of them together read as a screen half of which
   * does not apply to them (reported from his students' view of this page).
   */
  teacherFlags?: readonly NotificationFlag[];
}) {
  const t = useTranslations("Account.settings");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState({
    defaultLanguage: account.settings.defaultLanguage,
    flags: Object.fromEntries(
      [...flags, ...teacherFlags].map((flag) => [flag, account.settings[flag] === true]),
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

  const renderFlag = (flag: NotificationFlag) => (
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
  );

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
        {flags.map(renderFlag)}
      </fieldset>

      {teacherFlags.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{t("emailsTeacher")}</legend>
          {teacherFlags.map(renderFlag)}
        </fieldset>
      )}

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

/**
 * Signing oneself out of every session (G-021).
 *
 * AD-002 gave an administrator this button for somebody else's account and nobody had it for
 * their own -- so the person who has actually lost a laptop, who is the only one who knows it,
 * had to ask an administrator to act for them. It is the same one call
 * (`invalidateUserTokens`) against one's own id.
 *
 * **It ends this session too, and that is not a side effect to hide.** core-api stamps a validity
 * threshold rather than revoking a list, so the cookie in this browser dies with all the others;
 * the page therefore clears it through the app's own logout route and lands on `/login`, exactly
 * as the password form above does. Skipping that would leave the reader looking at a screen whose
 * next click is a 401.
 */
export function SignOutEverywhere({ userId }: { userId: string }) {
  const t = useTranslations("Account.sessions");
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function signOutEverywhere() {
    setPending(true);
    const result = await invalidateUserTokens(userId);
    if (!result.success) {
      setPending(false);
      setConfirming(false);
      toast.error(t("failed"), result.formError);
      return;
    }
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success(t("done"));
    router.push("/login");
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t("explain")}</p>
      <div>
        <button
          type="button"
          className={secondary}
          disabled={pending}
          onClick={() => setConfirming(true)}
        >
          {t("action")}
        </button>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => !open && setConfirming(false)}
        title={t("action")}
        description={t("confirm")}
        confirmLabel={t("action")}
        pending={pending}
        onConfirm={() => void signOutEverywhere()}
      />
    </div>
  );
}

/**
 * An application token of one's own (G-020).
 *
 * **The BFF half has existed since F-021 and nothing ever called it** -- `POST
 * /api/auth/restricted-token` had no caller anywhere in the repo, so the feature was reachable
 * only with `curl`. This is the form the route was built for, and it is the legacy app's own
 * "Generate Application Token": a credential to paste into a script, the same idea as a personal
 * access token elsewhere.
 *
 * **It calls the Route Handler rather than a Server Action, and that is the point.** DEC-043 has
 * this one route return the raw token in its response body -- the single deliberate exception to
 * DEC-021's "client components never see the token" -- because handing it to the reader to copy is
 * the whole feature. It never touches the session cookie: the token produced here is meant to
 * leave the app, not to replace this browser's session.
 *
 * **Shown once, and said so.** core-api stores no copy a screen could re-read, so navigating away
 * loses it -- there is nothing this app could do to show it again, and a reader who does not know
 * that will close the page and generate a second one. It is rendered in a read-only field rather
 * than as text so it can be selected and copied without a clipboard permission, with a copy button
 * where the browser allows one.
 */
export function ApplicationToken({ scopes }: { scopes: readonly TokenScope[] }) {
  const t = useTranslations("Account.token");
  const apiError = useApiErrorMessage();
  const toast = useToast();
  const [choice, setChoice] = useState<RestrictedTokenChoice>({
    scope: "read-all",
    expiration: 604800,
    refresh: true,
  });
  const [pending, setPending] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setPending(true);
    setIssued(null);
    try {
      const response = await fetch("/api/auth/restricted-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(restrictedTokenRequest(choice)),
      });
      const body = (await response.json().catch(() => ({}))) as ApiErrorBody & {
        accessToken?: string;
      };
      if (!response.ok || !body.accessToken) {
        toast.error(t("failed"), apiError(body.code, undefined));
        return;
      }
      setIssued(body.accessToken);
      setCopied(false);
    } catch {
      toast.error(t("failed"));
    } finally {
      setPending(false);
    }
  }

  async function copy() {
    if (issued === null) return;
    try {
      await navigator.clipboard.writeText(issued);
      setCopied(true);
    } catch {
      // Denied permission, or an insecure context. The field beside it is selectable, so there is
      // nothing to recover -- saying "copy it by hand" is more use than an error dialog.
      toast.error(t("copyFailed"));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("explain")}</p>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          {t("scope")}
          <select
            className={input}
            value={choice.scope}
            onChange={(event) =>
              setChoice((current) => ({ ...current, scope: event.target.value as TokenScope }))
            }
          >
            {scopes.map((scope) => (
              <option key={scope} value={scope}>
                {t(`scopes.${scope}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {t("expiration")}
          <select
            className={input}
            value={choice.expiration}
            onChange={(event) =>
              setChoice((current) => ({ ...current, expiration: Number(event.target.value) }))
            }
          >
            {TOKEN_EXPIRATIONS.map((seconds) => (
              <option key={seconds} value={seconds}>
                {t(`expirations.${seconds}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={choice.refresh}
            onChange={(event) =>
              setChoice((current) => ({ ...current, refresh: event.target.checked }))
            }
          />
          {t("refresh")}
        </label>

        <button
          type="button"
          disabled={pending}
          className={primary}
          onClick={() => void generate()}
        >
          {pending ? t("generating") : t("generate")}
        </button>
      </div>

      {choice.scope === "master" && (
        <p className="text-xs text-muted-foreground">{t("masterNote")}</p>
      )}

      {issued !== null && (
        <div className="flex flex-col gap-2 rounded-lg border border-warning bg-warning/10 p-3">
          <p className="text-sm font-medium">{t("issued.title")}</p>
          <p className="text-xs">{t("issued.onceOnly")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={issued}
              aria-label={t("issued.label")}
              onFocus={(event) => event.currentTarget.select()}
              className={`${input} min-w-0 flex-1 font-mono text-xs`}
            />
            <button type="button" className={secondary} onClick={() => void copy()}>
              {copied ? t("issued.copied") : t("issued.copy")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Seeing the app as somebody with fewer privileges sees it (G-023).
 *
 * **The other half of the endpoint G-020 uses, and DEC-043's unfiled "future ticket".** It
 * re-issues this browser's own token with core-api's `effectiveRole` claim set and installs it as
 * the session, keeping the scopes and remaining lifetime the token already had.
 *
 * **It is "view as", not dropping privileges, and it says so rather than implying otherwise.**
 * core-api's `validateEffectiveRole` compares the requested role against the **account's** role in
 * the database, not the calling token's, so a narrowed session can ask for its full role back and
 * be granted it -- verified live, a session narrowed to `student` re-issued itself as `superadmin`.
 * Nothing here is a containment boundary, and a reader who believed otherwise would be wrong.
 *
 * Offered to anyone with a role below their own, which is the legacy panel's rule and core-api's;
 * G-023's own wording said "superadmin only", which is narrower than either and would have kept it
 * from the supervisors who most want to see what a student sees.
 *
 * The whole page reloads afterwards rather than refreshing the route, for AD-003's reason: the
 * session now answers differently everywhere, and Next's client Router Cache is still holding
 * payloads rendered for the old one.
 */
export function EffectiveRole({
  accountRole,
  effectiveRole,
  roles,
}: {
  accountRole: string;
  /** The role currently acted as, or null when acting as the account itself. */
  effectiveRole: string | null;
  /** Every role at or below the account's, weakest first. */
  roles: readonly string[];
}) {
  const t = useTranslations("Account.viewAs");
  const apiError = useApiErrorMessage();
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);

  async function change(role: string | null) {
    setPending(role ?? "");
    try {
      const response = await fetch("/api/auth/effective-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
      if (!response.ok) {
        toast.error(t("failed"), apiError(body.code, undefined));
        setPending(null);
        return;
      }
      // A full load, not router.refresh(): every role-gated thing on every cached route was
      // rendered for the old session.
      window.location.reload();
    } catch {
      toast.error(t("failed"));
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("explain")}</p>
      <p className="text-xs text-muted-foreground">{t("notContainment")}</p>

      <div className="flex flex-wrap items-center gap-2">
        {roles.map((role) => {
          const active = (effectiveRole ?? accountRole) === role;
          return (
            <button
              key={role}
              type="button"
              aria-pressed={active}
              disabled={pending !== null}
              className={active ? primary : secondary}
              onClick={() => void change(role === accountRole ? null : role)}
            >
              {t(`roles.${role}`)}
            </button>
          );
        })}
      </div>

      {effectiveRole !== null && (
        <p className="text-sm">
          {t("current", { role: t(`roles.${effectiveRole}`) })}{" "}
          <button
            type="button"
            disabled={pending !== null}
            className="underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            onClick={() => void change(null)}
          >
            {t("restore")}
          </button>
        </p>
      )}
    </div>
  );
}

/**
 * The two interface preferences this app carries (G-022).
 *
 * **Two, out of the legacy panel's nine, and the other seven are in `docs/DROPPED.md` by name.**
 * Surnames-first, open-on-double-click and sidebar folding are decisions this redesign made
 * differently; the editor font size and Vim mode configure an in-browser code editor that does not
 * exist here; the source-viewer dark theme is superseded by the app-wide theme (F-010) which
 * D-009's viewer already follows; and Gravatar is a real setting that lives on the profile form
 * above rather than here, because it is about the account rather than the interface.
 *
 * **Both fields are always sent, and that is a guard rather than tidiness.** core-api merges what
 * this endpoint is given -- which is how AD-007's "broadcasts read up to" marker survives a save
 * here -- but an *empty* `uiData` is a silent no-op rather than a way to say "nothing": PHP counts
 * `[]` as empty, and the presenter returns 200 having changed nothing. So a form that posted `{}`
 * would tell the reader it had saved and not have. See `updateInterfacePreferences`.
 */
export function InterfacePreferences({
  userId,
  defaultPage,
  dateFormatOverride,
}: {
  userId: string;
  defaultPage: DefaultPage;
  dateFormatOverride: DateFormatLocale | "";
}) {
  const t = useTranslations("Account.preferences");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<InterfacePreferencesValues>({
    defaultPage,
    dateFormatOverride,
  });

  async function save() {
    setPending(true);
    const result = await updateInterfacePreferences(userId, draft);
    setPending(false);
    if (result.success) {
      toast.success(t("saved"));
      router.refresh();
      return;
    }
    toast.error(t("failed"), result.formError);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap gap-4">
        <Field label={t("defaultPage")} description={t("defaultPageHint")}>
          <select
            className={input}
            value={draft.defaultPage}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                defaultPage: event.target.value as DefaultPage,
              }))
            }
          >
            {DEFAULT_PAGES.map((page) => (
              <option key={page} value={page}>
                {t(`defaultPages.${page}`)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("dateFormat")} description={t("dateFormatHint")}>
          <select
            className={input}
            value={draft.dateFormatOverride}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                dateFormatOverride: event.target.value as DateFormatLocale | "",
              }))
            }
          >
            <option value="">{t("dateFormats.follow")}</option>
            {DATE_FORMAT_LOCALES.map((locale) => (
              <option key={locale} value={locale}>
                {t(`dateFormats.${locale}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div>
        <button type="submit" disabled={pending} className={primary}>
          {pending ? t("saving") : t("save")}
        </button>
      </div>
    </form>
  );
}
