import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/lib/api/current-user";
import { SUPERADMIN_TOKEN_SCOPES, TOKEN_SCOPES } from "@/lib/auth/restricted-token";
import { USER_ROLES } from "@/lib/api/user-roles";
import { getAccountSettings, getCalendarTokens, NOTIFICATION_FLAGS } from "@/lib/api/user-settings";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import {
  ApplicationToken,
  EffectiveRole,
  CalendarTokens,
  PasswordForm,
  ProfileForm,
  SettingsForm,
  SignOutEverywhere,
} from "@/components/users/account-forms";
import { PageShell } from "@/components/page-shell";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Account" });
  return { title: t("title") };
}

/**
 * The reader's own account (S-022): name and email, password, what ReCodEx emails them, and the
 * iCal tokens a calendar app can subscribe with (Q-014, parked here by S-003).
 *
 * **This screen is about oneself only.** core-api's `canUpdateProfile` would let an administrator
 * edit someone else, and the legacy app has one page for both; here that is AD-002's screen, and
 * this route resolves the id from the session rather than the URL -- so there is no id to tamper
 * with, and no way to arrive at someone else's account settings by editing an address bar.
 *
 * The password form is separate from the profile form on purpose: a successful password change
 * invalidates every token this user holds, so it ends with a sign-out. Nobody should lose their
 * session for correcting a name. G-021's "sign out everywhere" does the same thing deliberately
 * and without changing the password -- it is the thing to reach for after losing a laptop, and
 * until it was here only an administrator could do it to you.
 */
export default async function AccountSettingsPage() {
  const [locale, viewer] = await Promise.all([getLocale(), getCurrentUser()]);
  const [t, account, tokens, breadcrumbs] = await Promise.all([
    getTranslations("Account"),
    getAccountSettings(viewer.id),
    getCalendarTokens(viewer.id),
    resolveBreadcrumbs("/profile/edit", locale),
  ]);

  const apiBase = process.env.API_BASE_PUBLIC ?? "";

  // Every role at or below the account's. `USER_ROLES` is ordered weakest-first, so the account's
  // own index is the ceiling -- and core-api enforces the same rule on the call itself.
  const ceiling = USER_ROLES.indexOf(viewer.accountRole as (typeof USER_ROLES)[number]);
  const viewAsRoles = ceiling < 0 ? [] : USER_ROLES.slice(0, ceiling + 1);

  return (
    <PageShell
      title={t("title")}
      subtitle={account.email}
      breadcrumbs={breadcrumbs}
      actions={
        <Link
          href="/profile"
          className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {t("backToProfile")}
        </Link>
      }
    >
      <div className="flex flex-col gap-10">
        <section aria-labelledby="account-profile">
          <h2 id="account-profile" className="mb-3 text-base font-semibold tracking-tight">
            {t("profile.title")}
          </h2>
          <ProfileForm account={account} />
        </section>

        {account.isLocal && (
          <section aria-labelledby="account-password">
            <h2 id="account-password" className="mb-3 text-base font-semibold tracking-tight">
              {t("password.title")}
            </h2>
            <PasswordForm account={account} />
          </section>
        )}

        <section aria-labelledby="account-settings">
          <h2 id="account-settings" className="mb-3 text-base font-semibold tracking-tight">
            {t("settings.title")}
          </h2>
          <SettingsForm account={account} locales={routing.locales} flags={NOTIFICATION_FLAGS} />
        </section>

        <section aria-labelledby="account-sessions">
          <h2 id="account-sessions" className="mb-3 text-base font-semibold tracking-tight">
            {t("sessions.title")}
          </h2>
          <SignOutEverywhere userId={account.id} />
        </section>

        {/* G-023. Offered to anyone with a role below their own -- the legacy panel's rule and
            core-api's, which refuses a role above the account's. A plain student has nowhere to
            go, so the section is absent rather than empty. */}
        {viewAsRoles.length > 1 && (
          <section aria-labelledby="account-view-as">
            <h2 id="account-view-as" className="mb-3 text-base font-semibold tracking-tight">
              {t("viewAs.title")}
            </h2>
            <EffectiveRole
              accountRole={viewer.accountRole}
              effectiveRole={viewer.role === viewer.accountRole ? null : viewer.role}
              roles={viewAsRoles}
            />
          </section>
        )}

        <section aria-labelledby="account-token">
          <h2 id="account-token" className="mb-3 text-base font-semibold tracking-tight">
            {t("token.title")}
          </h2>
          {/* G-020. `group-external` is offered to a superadmin only, matching the legacy form --
              core-api does not itself refuse the scope to anybody, so this is an offer withheld
              rather than a permission enforced; see `lib/auth/restricted-token.ts`. */}
          <ApplicationToken
            scopes={viewer.role === "superadmin" ? SUPERADMIN_TOKEN_SCOPES : TOKEN_SCOPES}
          />
        </section>

        <section aria-labelledby="account-calendars">
          <h2 id="account-calendars" className="mb-3 text-base font-semibold tracking-tight">
            {t("calendars.title")}
          </h2>
          <CalendarTokens userId={account.id} tokens={tokens} apiBase={apiBase} />
        </section>
      </div>
    </PageShell>
  );
}
