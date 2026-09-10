"use client";

import { useState } from "react";
import { FormProvider } from "react-hook-form";
import { useTranslations } from "next-intl";

import { createUserAccount, type CreateUserOutcome } from "@/lib/actions/users";
import type { CreateUserValues } from "@/lib/actions/users.schema";
import { useServerActionForm } from "@/lib/forms/use-server-action-form";

import { useRouter } from "@/i18n/navigation";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/dialog/dialog";
import { Field } from "@/components/form/field";
import { FormError } from "@/components/form/form-error";
import { useToast } from "@/components/toast/toast-provider";

/**
 * Creating an account for somebody else (AD-001) -- the way a person who cannot register gets one
 * on a deployment where registration is closed, which is this one.
 *
 * **A name collision interrupts the submit rather than failing it.** core-api answers a 200 with
 * `usersWithSameName` when the instance already holds a Jan Novák, and it is asking whether this
 * is the same person; the dialog shows who it found and offers to go on, which sends
 * `ignoreNameCollision` the second time. A-003's public form handles the same answer, from the
 * other side of the desk.
 *
 * The password is set here and the new account is a student -- both core-api's doing, not a choice
 * this screen makes. Whoever it is for will have to be told the password out of band: this
 * deployment sends no mail (Q-007).
 */
export function CreateUser() {
  const t = useTranslations("Users.create");
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [sameName, setSameName] = useState<string[] | null>(null);

  const { form, onSubmit, isPending } = useServerActionForm<CreateUserValues, CreateUserOutcome>({
    schema: () => import("@/lib/actions/users.schema").then((module) => module.createUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      passwordConfirm: "",
      ignoreNameCollision: false,
    },
    action: createUserAccount,
    onSuccess: (outcome) => {
      if (!outcome.created) {
        setSameName(outcome.sameName);
        form.setValue("ignoreNameCollision", true);
        return;
      }
      setOpen(false);
      setSameName(null);
      form.reset();
      toast.success(t("created"));
      router.refresh();
    },
  });

  const {
    register,
    formState: { errors },
  } = form;
  const e = useTranslations("Users.create.errors");
  const input =
    "rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring aria-invalid:border-destructive";

  function change(next: boolean) {
    setOpen(next);
    if (!next) {
      setSameName(null);
      form.reset();
    }
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger className="self-start rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        {t("action")}
      </DialogTrigger>

      <DialogContent title={t("title")} description={t("explain")}>
        <FormProvider {...form}>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <FormError />

            {sameName && (
              <p
                role="alert"
                className="rounded-md border border-warning bg-warning/10 px-3 py-2 text-sm"
              >
                {t("collision", { names: sameName.join(", ") })}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("firstName")} error={errors.firstName && e("tooShort")}>
                <input
                  type="text"
                  autoComplete="off"
                  aria-invalid={errors.firstName ? true : undefined}
                  className={input}
                  {...register("firstName")}
                />
              </Field>
              <Field label={t("lastName")} error={errors.lastName && e("tooShort")}>
                <input
                  type="text"
                  autoComplete="off"
                  aria-invalid={errors.lastName ? true : undefined}
                  className={input}
                  {...register("lastName")}
                />
              </Field>
            </div>

            <Field label={t("email")} error={errors.email && e("invalidEmail")}>
              <input
                type="email"
                autoComplete="off"
                aria-invalid={errors.email ? true : undefined}
                className={input}
                {...register("email")}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("password")} error={errors.password && e("required")}>
                <input
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={errors.password ? true : undefined}
                  className={input}
                  {...register("password")}
                />
              </Field>
              <Field label={t("passwordConfirm")} error={errors.passwordConfirm && e("mismatch")}>
                <input
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={errors.passwordConfirm ? true : undefined}
                  className={input}
                  {...register("passwordConfirm")}
                />
              </Field>
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={() => change(false)}
                className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
              >
                {sameName ? t("createAnyway") : t("submit")}
              </button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
