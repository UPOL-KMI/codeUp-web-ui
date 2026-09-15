import { getFormatter, getTranslations } from "next-intl/server";
import { isTokenJudgeLog } from "@/lib/status/judge-log";

import type { SolutionEvaluation, SolutionTestResult } from "@/lib/api/solution";
import { formatPercent } from "@/lib/format/points";
import { exitCodeMessageKey } from "@/lib/status/exit-code";

import { Badge } from "@/components/status/badge";

/**
 * The evaluation half of the solution screen (S-015, `docs/IA.md` §4.4's left column): what the
 * pipeline did with this submission, test by test.
 *
 * Four outcomes, and they are genuinely different things rather than degrees of the same one:
 *
 * - **an infrastructure failure** -- the job never produced a result. The reader is not at fault
 *   and there is nothing for them to fix, so this says so plainly and shows core-api's own
 *   description rather than dressing it up as a test result.
 * - **no evaluation yet** -- submitted, queued or running. S-016 makes this update itself.
 * - **initiation failed** -- compilation (or setup) failed, so no test ran. The compiler output is
 *   the whole answer here, and it is the one thing that must not be buried behind a disclosure.
 * - **evaluated** -- the test table.
 *
 * Measured values, limit ratios and judge logs are each nulled independently by core-api according
 * to the assignment's own flags, so every one of those columns is conditional on the *data*
 * arriving rather than on a role check here. A column nobody may see is not rendered at all, which
 * is why the header is derived from the rows.
 */
function TestStatus({ result, label }: { result: SolutionTestResult; label: string }) {
  const tone = result.score >= 1 ? "success" : result.score <= 0 ? "danger" : "warning";
  return <Badge tone={tone}>{label}</Badge>;
}

/**
 * Takes the two fields it actually reads rather than a whole `SolutionDetail` (widened by T-011):
 * a **reference** solution has an evaluation of exactly this shape and none of the rest of an
 * assignment solution -- no attempt index, no points, no review -- so passing the entity would
 * have meant synthesising a fake one to reuse the only part that is genuinely shared.
 */
export interface EvaluatedSubmission {
  evaluation: SolutionEvaluation | null;
  failure: { type: string; description: string } | null;
}

/**
 * How a test's process ended (G-004). Three things core-api reports and this app used to throw
 * away, which between them are the difference between "Failed" and "your program divided by zero".
 *
 * `exitSignal` is the process being killed rather than returning at all. `exitCodeNative` says the
 * code is the program's own -- false means a signal, a timeout or the sandbox produced it, and
 * then there is nothing to name. `exitCodeOk` is the *exercise's* verdict on the code, which need
 * not be zero (`lib/exercise-config/exit-codes.ts` is where that is configured), so a code the
 * exercise accepts is shown as the number it is and one it does not is given its name where the
 * environment has one.
 */
function ExitCode({
  result,
  environment,
  t,
}: {
  result: SolutionTestResult;
  environment: string;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const code = result.exitCode;
  const key = code === null || result.exitCodeOk ? null : exitCodeMessageKey(environment, code);

  return (
    <>
      {result.exitSignal !== null && result.exitSignal !== 0 && (
        <div className="font-medium text-destructive">
          {t("exit.signal", { signal: result.exitSignal })}
        </div>
      )}
      {result.exitCodeNative ? (
        <div className={result.exitCodeOk ? "text-muted-foreground" : undefined}>
          {key !== null ? t(key) : code}
          {/* The exercise accepts a non-zero code, or refuses zero. Rare, and unexplained it
              reads as a contradiction. */}
          {(code === 0) !== result.exitCodeOk && (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {t("exit.successNote")}
            </span>
          )}
        </div>
      ) : (
        result.exitSignal === null &&
        result.status !== "SKIPPED" && <span className="text-muted-foreground">{code}</span>
      )}
    </>
  );
}

export async function EvaluationResults({
  solution,
  environment,
}: {
  solution: EvaluatedSubmission;
  /** The runtime environment id, which is what gives an exit code a name. */
  environment: string;
}) {
  const [t, format] = await Promise.all([getTranslations("Solution.evaluation"), getFormatter()]);

  if (solution.failure) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
        <h3 className="text-sm font-semibold text-destructive">{t("failure.title")}</h3>
        <p className="mt-1 text-sm">{t("failure.explanation")}</p>
        <pre className="mt-3 overflow-x-auto rounded-md bg-background/60 p-3 text-xs whitespace-pre-wrap">
          {solution.failure.description}
        </pre>
      </div>
    );
  }

  if (!solution.evaluation) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        {t("pending")}
      </div>
    );
  }

  const evaluation = solution.evaluation;

  if (evaluation.initFailed) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <h3 className="text-sm font-semibold text-destructive">{t("initFailed.title")}</h3>
          <p className="mt-1 text-sm">{t("initFailed.explanation")}</p>
        </div>
        {evaluation.initiationOutputs && (
          <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-xs whitespace-pre-wrap">
            {evaluation.initiationOutputs}
          </pre>
        )}
      </div>
    );
  }

  const results = evaluation.testResults;
  const showValues = results.some((result) => result.wallTime !== null || result.memory !== null);
  const showRatios = results.some(
    (result) => result.wallTimeRatio !== null || result.memoryRatio !== null,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border border-border bg-card p-4">
        <p className="text-2xl font-semibold tabular-nums">{formatPercent(evaluation.score)}</p>
        <p className="text-sm text-muted-foreground">
          {t("summary", {
            passed: results.filter((result) => result.score >= 1).length,
            total: results.length,
          })}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("evaluatedAt", {
            when: format.dateTime(new Date(evaluation.evaluatedAt * 1000), {
              dateStyle: "medium",
              timeStyle: "short",
            }),
          })}
        </p>
      </div>

      {results.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">{t("columns.test")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("columns.result")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("columns.score")}</th>
                {showValues && (
                  <>
                    <th className="px-3 py-2 text-right font-medium">{t("columns.time")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("columns.memory")}</th>
                  </>
                )}
                {showRatios && (
                  <th className="px-3 py-2 text-left font-medium">{t("columns.limits")}</th>
                )}
                <th className="px-3 py-2 text-left font-medium">{t("columns.exit")}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr key={result.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <div className="font-medium">{result.testName}</div>
                    {result.message && (
                      <div className="text-xs text-muted-foreground">{result.message}</div>
                    )}
                    {(() => {
                      const log = [result.judgeLogStdout, result.judgeLogStderr]
                        .filter(Boolean)
                        .join("\n");
                      if (log === "") return null;
                      return (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-muted-foreground">
                            {t("judgeLog")}
                          </summary>
                          <pre className="mt-1 overflow-x-auto rounded bg-muted/40 p-2 text-xs whitespace-pre-wrap">
                            {log}
                          </pre>
                          {/* Only over a log whose notation this legend actually describes -- a
                              custom judge writes whatever it likes, and a key to the wrong
                              notation is worse than none. See `isTokenJudgeLog`. */}
                          {isTokenJudgeLog(log) && (
                            <div className="mt-1 rounded border border-border bg-info-surface p-2 text-xs">
                              <p className="font-medium">{t("judgeLegend.title")}</p>
                              <ul className="mt-1 flex flex-col gap-0.5">
                                {(
                                  [
                                    "pairedLines",
                                    "missingLine",
                                    "extraLine",
                                    "column",
                                    "mismatch",
                                    "missingToken",
                                  ] as const
                                ).map((key) => (
                                  <li key={key}>{t(`judgeLegend.${key}`)}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </details>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2">
                    <TestStatus result={result} label={t(`status.${result.status}`)} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatPercent(result.score)}
                  </td>
                  {showValues && (
                    <>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                        {result.wallTime !== null
                          ? t("seconds", {
                              value: format.number(result.wallTime, {
                                maximumFractionDigits: 2,
                              }),
                            })
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                        {result.memory !== null
                          ? t("kibibytes", { value: format.number(result.memory) })
                          : "—"}
                      </td>
                    </>
                  )}
                  {showRatios && (
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {result.wallTimeExceeded && (
                          <Badge tone="danger">{t("exceeded.time")}</Badge>
                        )}
                        {result.cpuTimeExceeded && <Badge tone="danger">{t("exceeded.cpu")}</Badge>}
                        {result.memoryExceeded && (
                          <Badge tone="danger">{t("exceeded.memory")}</Badge>
                        )}
                        {!result.wallTimeExceeded &&
                          !result.cpuTimeExceeded &&
                          !result.memoryExceeded && (
                            <span className="text-xs text-muted-foreground">
                              {result.wallTimeRatio !== null
                                ? t("ofLimit", { percent: formatPercent(result.wallTimeRatio) })
                                : "—"}
                            </span>
                          )}
                      </div>
                    </td>
                  )}
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    <ExitCode result={result} environment={environment} t={t} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
