"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { importRoster } from "@/lib/actions/import-users";
import {
  MAX_ROWS,
  parseRoster,
  type ImportOutcome,
  type RosterRow,
} from "@/lib/users/import-roster";

import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/button";

/**
 * Importing a list of people (AD-009).
 *
 * **The preview is the whole point of the screen.** What is pasted is somebody's spreadsheet
 * export, and the ways it goes wrong -- a shifted column, a header in the wrong language, a
 * duplicate row -- are all visible before anything is sent and invisible afterwards. Parsing
 * happens here, in the browser, so it happens on every keystroke and costs nothing; the action
 * receives rows that have already been read, not text to interpret a second time.
 *
 * Nothing about the result is written into the page's own data, so the outcome table is state
 * rather than a refresh: the accounts it reports on do not exist yet.
 */
export function ImportRosterForm({
  groupId,
  groupName,
}: {
  /** Present when the import was opened from a group: everyone invited lands in it. */
  groupId?: string;
  groupName?: string;
}) {
  const t = useTranslations("UserImport");
  const router = useRouter();
  const [text, setText] = useState("");
  const [invite, setInvite] = useState(true);
  const [locale, setLocale] = useState("cs");
  const [pending, setPending] = useState(false);
  const [outcomes, setOutcomes] = useState<ImportOutcome[] | null>(null);

  const parsed = useMemo(() => parseRoster(text), [text]);
  const tooMany = parsed.rows.length > MAX_ROWS;

  async function run(rows: RosterRow[]) {
    setPending(true);
    setOutcomes(null);
    const result = await importRoster(rows, {
      groups: groupId === undefined ? [] : [groupId],
      locale,
      invite,
    });
    setPending(false);
    setOutcomes(result.outcomes);
    // Whoever already had an account may have gained an identifier, and a group may have gained
    // a member; both are on pages behind this one.
    router.refresh();
  }

  const invited = outcomes?.filter((outcome) => outcome.state === "invited").length ?? 0;
  const matched = outcomes?.filter((outcome) => outcome.state === "matched").length ?? 0;
  const failed = outcomes?.filter((outcome) => outcome.state === "failed").length ?? 0;
  const skipped = outcomes?.filter((outcome) => outcome.state === "skipped").length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {groupName === undefined ? t("explain") : t("explainGroup", { group: groupName })}
        </p>
        <details className="rounded-md border border-border p-3 text-sm">
          <summary className="cursor-pointer font-medium">{t("format.title")}</summary>
          <div className="mt-2 flex flex-col gap-2 text-muted-foreground">
            <p>{t("format.columns")}</p>
            <p>{t("format.identifiers")}</p>
            <pre className="overflow-x-auto rounded-md bg-muted p-2 text-xs">
              {t("format.example")}
            </pre>
          </div>
        </details>
      </section>

      <label className="flex flex-col gap-1 text-sm">
        {t("paste")}
        <textarea
          rows={10}
          value={text}
          onChange={(event) => setText(event.target.value)}
          spellCheck={false}
          className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
        />
      </label>

      {parsed.problems.length > 0 && (
        <div
          role="alert"
          className="flex flex-col gap-1 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
        >
          {parsed.problems.map((problem) => (
            <p key={`${problem.line}-${problem.reason}`}>
              {t(`problems.${problem.reason}`, { line: problem.line })}
            </p>
          ))}
        </div>
      )}

      {parsed.rows.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">
            {t("preview", { count: parsed.rows.length })}
            {parsed.identifierKeys.length > 0 &&
              ` · ${t("previewIdentifiers", { keys: parsed.identifierKeys.join(", ") })}`}
          </h3>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="px-3 py-2">{t("columns.email")}</th>
                  <th className="px-3 py-2">{t("columns.name")}</th>
                  {parsed.identifierKeys.map((key) => (
                    <th key={key} className="px-3 py-2">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 10).map((row) => (
                  <tr key={row.email} className="border-t border-border">
                    <td className="px-3 py-1.5">{row.email}</td>
                    <td className="px-3 py-1.5">
                      {[row.titlesBeforeName, row.firstName, row.lastName, row.titlesAfterName]
                        .filter(Boolean)
                        .join(" ")}
                    </td>
                    {parsed.identifierKeys.map((key) => (
                      <td key={key} className="px-3 py-1.5">
                        <code className="text-xs">{row.externalIds[key] ?? ""}</code>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsed.rows.length > 10 && (
            <p className="text-xs text-muted-foreground">
              {t("previewTruncated", { count: parsed.rows.length - 10 })}
            </p>
          )}
        </section>
      )}

      <div className="flex flex-col gap-2 text-sm">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5 size-4"
            checked={invite}
            onChange={(event) => setInvite(event.target.checked)}
          />
          <span className="flex flex-col gap-0.5">
            <span>{t("invite")}</span>
            <span className="text-xs text-muted-foreground">{t("inviteHint")}</span>
          </span>
        </label>
        <label className="flex items-center gap-2">
          {t("mailLanguage")}
          <select
            value={locale}
            onChange={(event) => setLocale(event.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="cs">{t("locales.cs")}</option>
            <option value="en">{t("locales.en")}</option>
          </select>
        </label>
      </div>

      {tooMany && <p className="text-sm text-destructive">{t("tooMany", { max: MAX_ROWS })}</p>}

      <div>
        <Button
          variant="primary"
          size="md"
          disabled={pending || tooMany || parsed.rows.length === 0}
          onClick={() => void run(parsed.rows)}
        >
          {pending ? t("running") : t("run", { count: parsed.rows.length })}
        </Button>
      </div>

      {outcomes !== null && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">
            {t("result", { invited, matched, skipped, failed })}
          </h3>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="px-3 py-2">{t("columns.email")}</th>
                  <th className="px-3 py-2">{t("columns.outcome")}</th>
                </tr>
              </thead>
              <tbody>
                {outcomes.map((outcome) => (
                  <tr key={outcome.email} className="border-t border-border">
                    <td className="px-3 py-1.5">{outcome.email}</td>
                    <td className="px-3 py-1.5">
                      <span className="flex flex-col gap-0.5">
                        <span>{t(`outcomes.${outcome.state}`)}</span>
                        {outcome.identifiersSet.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {t("outcomes.identifiersSet", {
                              services: outcome.identifiersSet.join(", "),
                            })}
                          </span>
                        )}
                        {outcome.identifiersFailed.map((entry) => (
                          <span key={entry.service} className="text-xs text-destructive">
                            {entry.code === "taken"
                              ? t("outcomes.identifierTaken", {
                                  service: entry.service,
                                  owner: entry.owner ?? "",
                                })
                              : t("outcomes.identifierFailed", { service: entry.service })}
                          </span>
                        ))}
                        {outcome.state === "failed" && (
                          <span className="text-xs text-destructive">{outcome.reason ?? ""}</span>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
