"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { importClassroomExercise } from "@/lib/actions/exercise-import";
import {
  ClassroomParseError,
  importedTestFileNames,
  parseAutograding,
  type ClassroomImport,
} from "@/lib/import/classroom";
import { uploadFileChunked } from "@/lib/upload/chunked-upload";

import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/toast/toast-provider";
import { buttonClasses } from "@/components/button";

/**
 * Importing a GitHub Classroom assignment (X-001).
 *
 * **Two steps, and the first one writes nothing.** Reading the file happens here in the browser --
 * `lib/import/classroom.ts` is a pure module, so there is no round trip and no exercise until the
 * author has seen the report. That order is the whole design: the interesting output of an import
 * is not the tests it can carry but the list of things it cannot, and a wizard that hides them
 * produces an exercise which grades nothing while appearing to have worked.
 *
 * The test data goes through S-014's chunked upload route rather than the Server Action that
 * follows it, because Server Actions cap a request body at about 1 MB (brief §6.7) and a test's
 * expected output is arbitrary data. It is the same path a solution takes.
 */
const INPUT =
  "w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";

/** The first markdown heading of the README, which is what the exercise is called upstream. */
function nameFromReadme(readme: string): string {
  return /^#\s+(.+)$/m.exec(readme)?.[1]?.trim() ?? "";
}

export function ImportClassroom({
  groups,
  environments,
}: {
  groups: { id: string; name: string }[];
  environments: { id: string; name: string }[];
}) {
  const t = useTranslations("ExerciseImport");
  const router = useRouter();
  const toast = useToast();

  const [groupId, setGroupId] = useState("");
  const [name, setName] = useState("");
  const [autograding, setAutograding] = useState("");
  const [readme, setReadme] = useState("");
  const [environment, setEnvironment] = useState("");
  const [report, setReport] = useState<ClassroomImport | null>(null);
  const [pending, setPending] = useState(false);

  function read() {
    let parsed: ClassroomImport;
    try {
      parsed = parseAutograding(autograding);
    } catch (error) {
      setReport(null);
      // `ClassroomParseError` is the only failure the parser raises, and it means "this is not one
      // of those files" -- anything else would be a bug here rather than in the input, so it is
      // re-thrown to the error boundary instead of being dressed up as the reader's mistake.
      if (!(error instanceof ClassroomParseError)) throw error;
      toast.error(t("parseFailed"));
      return;
    }
    setReport(parsed);
    // Offered, not imposed: a guess the author can see and change beats a hidden default.
    if (parsed.environment !== null && environment === "") setEnvironment(parsed.environment);
    if (name === "") setName(nameFromReadme(readme));
  }

  async function create() {
    if (report === null) return;
    setPending(true);
    try {
      const uploadedFileIds: string[] = [];
      const tests = [];
      for (const [index, test] of report.tests.entries()) {
        const names = importedTestFileNames(test.name, index);
        const stdin = await uploadFileChunked(
          new File([test.stdin], names.stdin, { type: "text/plain" }),
        );
        const expected = await uploadFileChunked(
          new File([test.expectedOutput], names.expectedOutput, { type: "text/plain" }),
        );
        uploadedFileIds.push(stdin.id, expected.id);
        tests.push({
          name: test.name,
          weight: test.weight,
          judgeType: test.judgeType,
          stdinFileName: names.stdin,
          expectedFileName: names.expectedOutput,
        });
      }

      const result = await importClassroomExercise({
        groupId,
        name,
        text: readme,
        environment,
        uploadedFileIds,
        tests,
      });
      if (result.success) {
        toast.success(t("imported"));
        router.push(`/exercises/${result.data.id}/edit`);
        return;
      }
      setPending(false);
      toast.error(result.formError ?? t("errors.unknown"));
    } catch {
      setPending(false);
      toast.error(t("errors.uploadFailed"));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">{t("intro")}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t("groupLabel")}
          <select
            value={groupId}
            onChange={(event) => setGroupId(event.target.value)}
            className={INPUT}
          >
            <option value="">{t("groupChoose")}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t("nameLabel")}
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("namePlaceholder")}
            className={INPUT}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {t("autogradingLabel")}
        <textarea
          value={autograding}
          onChange={(event) => setAutograding(event.target.value)}
          rows={8}
          spellCheck={false}
          className={`${INPUT} font-mono`}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {t("readmeLabel")}
        <textarea
          value={readme}
          onChange={(event) => setReadme(event.target.value)}
          rows={6}
          className={INPUT}
        />
      </label>

      <div>
        <button type="button" onClick={read} className={buttonClasses("outline", "sm")}>
          {t("check")}
        </button>
      </div>

      {report !== null && (
        <section aria-labelledby="import-report" className="flex flex-col gap-4">
          <h2 id="import-report" className="text-base font-semibold tracking-tight">
            {t("reportHeading")}
          </h2>
          <p className="text-sm">
            {t("declared", { declared: report.declared, mapped: report.tests.length })}
          </p>

          <label className="flex max-w-xs flex-col gap-1 text-xs text-muted-foreground">
            {t("environmentLabel")}
            <select
              value={environment}
              onChange={(event) => setEnvironment(event.target.value)}
              className={INPUT}
            >
              <option value="">{t("groupChoose")}</option>
              {environments.map((one) => (
                <option key={one.id} value={one.id}>
                  {one.name}
                </option>
              ))}
            </select>
            <span>
              {report.environment === null ? t("environmentUnknown") : t("environmentGuessed")}
            </span>
          </label>

          {report.tests.length === 0 ? (
            <p className="text-sm font-medium">{t("nothingMapped")}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">{t("mappedHeading")}</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {report.tests.map((test) => (
                  <li key={test.name} className="flex flex-wrap gap-2">
                    <span className="font-medium">{test.name}</span>
                    <span className="text-muted-foreground">
                      {test.judgeType === "diff" ? t("testJudgeExact") : t("testJudgeToken")}
                    </span>
                    <span className="text-muted-foreground">
                      {t("testWeight", { weight: test.weight })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t("notesHeading")}</h3>
            {report.notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noNotes")}</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {report.notes.map((note, index) => (
                  <li
                    key={`${note.test}-${note.kind}-${index}`}
                    className="rounded-md border border-border p-2"
                  >
                    <span className="font-medium">{note.test}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t(`severity.${note.severity}`)}
                    </span>
                    <p className="mt-1 text-muted-foreground">{t(`notes.${note.kind}`)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            {t("notAssignable")}
          </p>

          <div>
            <button
              type="button"
              onClick={create}
              disabled={pending || report.tests.length === 0}
              className={buttonClasses("primary", "sm")}
            >
              {pending ? t("importing") : t("import")}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
