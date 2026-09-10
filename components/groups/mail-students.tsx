import { getTranslations } from "next-intl/server";

import type { GroupStudent } from "@/lib/api/group-detail";
import { groupMailto } from "@/lib/format/mailto";

/**
 * Mailing the whole class (G-011), from the roster it is about.
 *
 * **A plain link, no JavaScript**, for the reason T-007's export link gives (DEC-095): handing the
 * reader's own mail client a `mailto:` is something HTML does, and a client island would only put
 * a round trip in front of it. The addresses are already on the page -- the roster's read now
 * carries `privateData.email`, which the same `/v1/users/list` response was returning and this app
 * was discarding -- so this costs no request of its own.
 *
 * **Offered on the group's `sendEmail` hint alone.** The legacy screen asks for `viewStudents` too,
 * but this component only ever renders inside the Students tab, which does not exist without it
 * (the tab list is built from that hint). Note what the ACL does *not* require: `sendEmail` carries
 * no `group.isNotArchived` condition, unlike almost every other group write, so a finished course
 * can still be written to -- deliberately, and the legacy app allows it too.
 *
 * Three things are said in words rather than left to be discovered:
 *
 * - **Addresses core-api did not disclose.** The response omits `privateData` per person, so a
 *   roster of thirty can yield twenty-eight addresses. Mailing twenty-eight people while the table
 *   above shows thirty is the kind of near-miss nobody notices, so the count is stated.
 * - **A list long enough to be truncated.** See `groupMailto` -- desktop mail handlers cut long
 *   `mailto:` URLs short instead of refusing them.
 * - **The addresses themselves**, as copyable text. It is the answer to both of the above: a
 *   teacher whose client truncated the link, or who wants the class in a mailing list rather than
 *   one message, can take them from here without downloading the points CSV to get at them.
 */
export async function MailStudents({ students }: { students: GroupStudent[] }) {
  const t = await getTranslations("Group.students.mail");
  const { href, addresses, undisclosed, mayTruncate } = groupMailto(students);

  // No address at all is not a broken link to render: it is core-api declining to disclose them,
  // which is a different sentence from "this group has nobody in it".
  if (href === null) {
    return <p className="text-xs text-muted-foreground">{t("noneDisclosed")}</p>;
  }

  return (
    <section aria-labelledby="group-mail" className="flex flex-col gap-2">
      <h2 id="group-mail" className="sr-only">
        {t("title")}
      </h2>
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={href}
          className="inline-block rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {t("action", { count: addresses.length })}
        </a>
        <span className="text-xs text-muted-foreground">{t("bcc")}</span>
      </div>

      {undisclosed > 0 && (
        <p className="text-xs text-muted-foreground">{t("undisclosed", { count: undisclosed })}</p>
      )}

      {mayTruncate && (
        <p className="rounded-md border border-warning bg-warning/10 px-3 py-2 text-xs">
          {t("mayTruncate")}
        </p>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          {t("list.summary")}
        </summary>
        <textarea
          readOnly
          rows={3}
          aria-label={t("list.label")}
          defaultValue={addresses.join(", ")}
          className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
        />
      </details>
    </section>
  );
}
