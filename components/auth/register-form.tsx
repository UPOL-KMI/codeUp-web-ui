"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";

/**
 * Creating an account (A-003).
 *
 * **Two things are asked of core-api while the form is being filled in**, both from one public
 * endpoint: whether the address is already taken, and how strong the password is. Telling somebody
 * their address is taken before they have chosen a password is the difference between a hint and a
 * rejection.
 *
 * **A name collision is a question, not a failure.** core-api answers a registration with
 * `{user: null, usersWithSameName}` and a 200 when somebody with the same first and last name
 * already exists in the instance -- it is asking whether one of them is this person. So the form
 * shows them and offers to go on, which sends `ignoreNameCollision` the second time. Treating that
 * as an error would leave a reader stuck with a name they cannot change.
 *
 * On success the account exists **and is signed in**: core-api returns an access token with the
 * new user, and the route turns it into the session the same way login does.
 */
export function RegisterForm({ instances }: { instances: { id: string; name: string }[] }) {
  const t = useTranslations("Register");
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [instanceId, setInstanceId] = useState(instances[0]?.id ?? "");
  const [emailIsFree, setEmailIsFree] = useState<boolean | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [collision, setCollision] = useState<string[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (email === "" && password === "") return;
    const timeout = setTimeout(() => {
      void fetch("/api/auth/registration-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((body: { emailIsFree?: boolean | null; score?: number | null } | null) => {
          setEmailIsFree(body?.emailIsFree ?? null);
          setScore(body?.score ?? null);
        })
        .catch(() => undefined);
    }, 400);
    return () => clearTimeout(timeout);
  }, [email, password]);

  const mismatched = passwordConfirm !== "" && passwordConfirm !== password;

  async function submit(event: React.FormEvent, ignoreNameCollision = false) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        firstName,
        lastName,
        password,
        passwordConfirm,
        instanceId,
        ignoreNameCollision,
      }),
    }).catch(() => null);

    const body = (await response?.json().catch(() => null)) as {
      success?: boolean;
      signedIn?: boolean;
      nameCollision?: string[];
      message?: string;
    } | null;

    if (body?.nameCollision) {
      setPending(false);
      setCollision(body.nameCollision);
      return;
    }

    if (!response || !response.ok || !body?.success) {
      setPending(false);
      setError(body?.message ?? t("errors.failed"));
      return;
    }

    router.refresh();
    router.push(body.signedIn ? "/dashboard" : "/login");
  }

  const input =
    "rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {collision && (
        <div className="flex flex-col gap-2 rounded-md border border-warning bg-warning/10 px-3 py-2 text-sm">
          <p>{t("collision.explain", { names: collision.join(", ") })}</p>
          <div>
            <button
              type="button"
              disabled={pending}
              onClick={(event) => void submit(event, true)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
            >
              {t("collision.continue")}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          {t("firstName")}
          <input
            type="text"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            autoComplete="given-name"
            required
            minLength={2}
            className={input}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          {t("lastName")}
          <input
            type="text"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            autoComplete="family-name"
            required
            minLength={2}
            className={input}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        {t("email")}
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          required
          aria-invalid={emailIsFree === false}
          className={input}
        />
        {emailIsFree === false && (
          <span role="alert" className="text-xs text-destructive">
            {t("errors.emailTaken")}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {t("password")}
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          required
          className={input}
        />
        {password !== "" && score !== null && (
          <span className={`text-xs ${score === 0 ? "text-destructive" : "text-muted-foreground"}`}>
            {t(`strength.${score}`)}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {t("passwordConfirm")}
        <input
          type="password"
          value={passwordConfirm}
          onChange={(event) => setPasswordConfirm(event.target.value)}
          autoComplete="new-password"
          required
          aria-invalid={mismatched}
          className={input}
        />
        {mismatched && (
          <span role="alert" className="text-xs text-destructive">
            {t("errors.mismatch")}
          </span>
        )}
      </label>

      {instances.length > 1 && (
        <label className="flex flex-col gap-1 text-sm">
          {t("instance")}
          <select
            value={instanceId}
            onChange={(event) => setInstanceId(event.target.value)}
            className={input}
          >
            {instances.map((instance) => (
              <option key={instance.id} value={instance.id}>
                {instance.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <button
        type="submit"
        disabled={pending || mismatched || emailIsFree === false || score === 0}
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
      >
        {pending ? t("creating") : t("create")}
      </button>
    </form>
  );
}
