"use client";

import { useState } from "react";
import { FormProvider } from "react-hook-form";
import { useTranslations } from "next-intl";

import { changePassword } from "@/lib/actions/account";
import { passwordSchema, type PasswordValues } from "@/lib/actions/account.schema";
import {
  createLocalLogin,
  invalidateUserTokens,
  setUserAllowed,
  setUserRole,
} from "@/lib/actions/users";
import { removeUserExternalId, setUserExternalId } from "@/lib/actions/user-external-ids";
import type { UserRoleValues } from "@/lib/actions/users.schema";
import { USER_ROLES } from "@/lib/api/user-roles";
import type { AccountSettings } from "@/lib/api/user-settings";
import { useServerActionForm } from "@/lib/forms/use-server-action-form";
import type { ActionResult } from "@/lib/forms/action-result";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { Field } from "@/components/form/field";
import { useToast } from "@/components/toast/toast-provider";

/**
 * The parts of somebody else's account only an administrator edits (AD-002).
 *
 * The name-and-email form is **not** here: it is S-022's `ProfileForm`, unchanged, because it is
 * the same form and core-api's `updateProfile` is the same call whoever makes it. What is here is
 * everything that only makes sense about *another* person.
 *
 * Nothing in this file is reachable on one's own account -- the route sends an administrator
 * editing themselves to their own settings screen -- which is not a stylistic choice: core-api
 * refuses `setRole` and `setIsAllowed` on oneself outright, and refuses a forced password change on
 * oneself through a rule that outranks even the superadmin's blanket allow (all three verified
 * live). A screen that offered them there could only ever fail.
 */
const input =
  "rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring aria-invalid:border-destructive";
const primary =
  "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60";
const secondary =
  "rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60";

/**
 * Setting a password without knowing the old one.
 *
 * core-api allows exactly this when `oldPassword` is absent and the caller holds
 * `forceChangePassword` on the target, so the same action S-022 uses is reused with the old
 * password left empty -- and **the sign-out that form ends with does not happen here**. The
 * validity threshold core-api stamps belongs to the account being edited, not to the administrator
 * making the change: they stay signed in, and the person whose password changed is signed out
 * everywhere. Confirmed live, where the response carried no refreshed token at all.
 */
export function AdminPasswordForm({ account }: { account: AccountSettings }) {
  const t = useTranslations("UserEdit.password");
  const router = useRouter();
  const toast = useToast();

  const { form, onSubmit, isPending } = useServerActionForm<PasswordValues, { userId: string }>({
    schema: passwordSchema,
    defaultValues: { oldPassword: "", password: "", passwordConfirm: "" },
    action: (values) => changePassword(account.id, { ...values, oldPassword: "" }),
    onSuccess: () => {
      form.reset();
      toast.success(t("changed"));
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
        <p className="text-sm text-muted-foreground">{t("explain")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("newPassword")} error={errors.password && t("errors.required")}>
            <input
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.password ? true : undefined}
              className={input}
              {...register("password")}
            />
          </Field>
          <Field
            label={t("confirmPassword")}
            error={errors.passwordConfirm && t("errors.mismatch")}
          >
            <input
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.passwordConfirm ? true : undefined}
              className={input}
              {...register("passwordConfirm")}
            />
          </Field>
        </div>

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

/**
 * The role, which is the one field here that changes what the person may do everywhere -- so it
 * confirms, and the confirmation names both roles rather than saying "are you sure".
 */
export function RoleForm({ account }: { account: AccountSettings }) {
  const t = useTranslations("UserEdit.role");
  const router = useRouter();
  const toast = useToast();
  const [chosen, setChosen] = useState(account.role);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    const result = await setUserRole(account.id, { role: chosen as UserRoleValues["role"] });
    setPending(false);
    if (!result.success) {
      toast.error(t("failed"), result.formError);
      return;
    }
    setConfirming(false);
    toast.success(t("changed", { role: t(`names.${chosen}`) }));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t("explain")}</p>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t("label")}>
          <select
            value={chosen}
            onChange={(event) => setChosen(event.target.value)}
            className={input}
          >
            {USER_ROLES.map((role) => (
              <option key={role} value={role}>
                {t(`names.${role}`)}
              </option>
            ))}
          </select>
        </Field>
        <button
          type="button"
          disabled={chosen === account.role}
          onClick={() => setConfirming(true)}
          className={primary}
        >
          {t("save")}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{t(`descriptions.${chosen}`)}</p>

      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => !open && setConfirming(false)}
        title={t("save")}
        description={t("confirm", {
          from: t(`names.${account.role}`),
          to: t(`names.${chosen}`),
        })}
        confirmLabel={t("save")}
        destructive={false}
        pending={pending}
        onConfirm={() => void save()}
      />
    </div>
  );
}

/**
 * The three things that are about the account rather than about the person: whether it may be used
 * at all, whether the sessions it has right now survive, and whether it has a local password to
 * sign in with.
 *
 * They read alike and are three different sizes. Disabling refuses the person everything until
 * somebody undoes it; signing them out everywhere lets them straight back in with their password;
 * creating a local login only appears where core-api would accept it -- on an account that has
 * none -- and leaves the password empty, which is what the form above it is for.
 */
export function AccountAccess({ account }: { account: AccountSettings }) {
  const t = useTranslations("UserEdit.access");
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState<"allowed" | "tokens" | null>(null);
  const [pending, setPending] = useState(false);

  async function run(
    call: () => Promise<ActionResult<unknown>>,
    successKey: "enabled" | "disabled" | "signedOut",
    failureKey: "allowedFailed" | "tokensFailed",
  ) {
    setPending(true);
    const result = await call();
    setPending(false);
    if (!result.success) {
      toast.error(t(failureKey), result.formError);
      return;
    }
    setConfirming(null);
    toast.success(t(successKey));
    router.refresh();
  }

  async function makeLocal() {
    setPending(true);
    const result = await createLocalLogin(account.id);
    setPending(false);
    if (!result.success) {
      toast.error(t("localFailed"), result.formError);
      return;
    }
    toast.success(t("localCreated"));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {account.isAllowed ? t("stateEnabled") : t("stateDisabled")}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={secondary} onClick={() => setConfirming("allowed")}>
          {account.isAllowed ? t("disable") : t("enable")}
        </button>
        <button type="button" className={secondary} onClick={() => setConfirming("tokens")}>
          {t("signOutEverywhere")}
        </button>
        {!account.isLocal && (
          <button
            type="button"
            disabled={pending}
            className={secondary}
            onClick={() => void makeLocal()}
          >
            {t("createLocal")}
          </button>
        )}
      </div>
      {!account.isLocal && <p className="text-xs text-muted-foreground">{t("createLocalHint")}</p>}

      <ConfirmDialog
        open={confirming === "allowed"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={account.isAllowed ? t("disable") : t("enable")}
        description={account.isAllowed ? t("confirmDisable") : t("confirmEnable")}
        confirmLabel={account.isAllowed ? t("disable") : t("enable")}
        destructive={account.isAllowed}
        pending={pending}
        onConfirm={() =>
          void run(
            () => setUserAllowed(account.id, !account.isAllowed),
            account.isAllowed ? "disabled" : "enabled",
            "allowedFailed",
          )
        }
      />

      <ConfirmDialog
        open={confirming === "tokens"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={t("signOutEverywhere")}
        description={t("confirmSignOut")}
        confirmLabel={t("signOutEverywhere")}
        pending={pending}
        onConfirm={() =>
          void run(() => invalidateUserTokens(account.id), "signedOut", "tokensFailed")
        }
      />
    </div>
  );
}

/**
 * The identities this person holds in other systems (AD-002): `stag` for UPOL's study information
 * system, and whatever else a deployment records.
 *
 * **The service is a free string, because core-api treats it as one** -- there is no list of known
 * services to offer, and inventing one here would mean an identifier this app refuses to store
 * while the API would have taken it. The one shipped suggestion is the datalist below, which
 * suggests without restricting.
 *
 * Written one at a time rather than as a form over the whole set, because that is the shape of
 * the endpoints: one `POST` per service, one `DELETE` per service, no way to replace the list.
 */
export function ExternalIds({ account }: { account: AccountSettings }) {
  const t = useTranslations("UserEdit.externalIds");
  const router = useRouter();
  const toast = useToast();
  const [service, setService] = useState("");
  const [externalId, setExternalId] = useState("");
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const entries = Object.entries(account.externalIds);

  async function add() {
    setPending(true);
    const result = await setUserExternalId(account.id, service, externalId);
    setPending(false);
    if (!result.success) {
      toast.error(t("errors.setFailed"), result.formError);
      return;
    }
    setService("");
    setExternalId("");
    toast.success(t("saved"));
    router.refresh();
  }

  async function remove(removedService: string) {
    setPending(true);
    const result = await removeUserExternalId(account.id, removedService);
    setPending(false);
    setRemoving(null);
    if (!result.success) {
      toast.error(t("errors.removeFailed"), result.formError);
      return;
    }
    toast.success(t("removed"));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t("explain")}</p>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map(([entryService, identifier]) => (
            <li
              key={entryService}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <span className="flex flex-wrap items-baseline gap-2">
                <span className="font-medium">{entryService}</span>
                <code className="text-xs">{identifier}</code>
              </span>
              <button
                type="button"
                disabled={pending}
                className={secondary}
                aria-label={t("removeNamed", { service: entryService })}
                onClick={() => setRemoving(entryService)}
              >
                {t("remove")}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          {t("service")}
          <input
            type="text"
            list="external-id-services"
            className={input}
            value={service}
            onChange={(event) => setService(event.target.value)}
          />
        </label>
        <datalist id="external-id-services">
          <option value="stag" />
        </datalist>
        <label className="flex flex-col gap-1 text-sm">
          {t("identifier")}
          <input
            type="text"
            maxLength={128}
            className={input}
            value={externalId}
            onChange={(event) => setExternalId(event.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={pending || service.trim() === "" || externalId.trim() === ""}
          className={primary}
          onClick={() => void add()}
        >
          {t("add")}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{t("hint")}</p>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t("confirmRemove.title")}
        description={t("confirmRemove.description", { service: removing ?? "" })}
        confirmLabel={t("remove")}
        destructive
        pending={pending}
        onConfirm={() => void remove(removing ?? "")}
      />
    </div>
  );
}
