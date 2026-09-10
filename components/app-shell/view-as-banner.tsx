import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

/**
 * Says, on every page, that this session is narrowed (G-023).
 *
 * **Not optional chrome.** A reader who narrowed their session an hour ago and forgot is looking
 * at an app that is missing things for no visible reason, and their next assumption is that
 * something is broken. Takeover (AD-003) could not do this -- core-api's token there carries
 * nothing naming the administrator (DEC-112) -- but the `effrole` claim is right there in this
 * one, so the thing AD-003 had to leave unsaid can be said here.
 *
 * Above the broadcast banner rather than below it: what the reader is currently able to do frames
 * everything else on the page, including the broadcasts.
 */
export async function ViewAsBanner({ role }: { role: string }) {
  const t = await getTranslations("Nav.viewAs");

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 border-b border-warning bg-warning/10 px-4 py-2 text-sm"
    >
      <span>{t("banner", { role: t(`roles.${role}`) })}</span>
      <Link
        href="/profile/edit"
        className="underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {t("restore")}
      </Link>
    </div>
  );
}
