import { getTranslations } from "next-intl/server";

import { printScoreExpression, type ScoreNode } from "@/lib/exercise-config/score-expression";

/**
 * How this run's score was arrived at (G-004).
 *
 * **It is the configuration the exercise had when the run happened, not the one it has now.**
 * core-api stores a copy on each evaluation, which is the whole point of showing it here: a
 * teacher looking at an old run wants to know what the rules were then, and a student asking "why
 * did I get 60%" is asking about the calculator rather than about a test.
 *
 * Each calculator stores something different under `config`, and handing one calculator's shape to
 * another's reader is not a no-op -- it is a crash on the render path, which is how T-025's own
 * screen broke once. So the shape is chosen by the name, and a calculator this app has not been
 * taught is named without pretending to explain it.
 *
 * Never rendered with data on this development host: core-api reads the config off the evaluation,
 * and no evaluation here has ever produced one (DEC-031).
 */
export async function ScoreConfigExplanation({
  scoreConfig,
}: {
  scoreConfig: { calculator: string; config: unknown } | null;
}) {
  const t = await getTranslations("Solution.scoreConfig");
  if (scoreConfig === null) return null;

  // Named where this app knows the name, and printed raw where it does not -- core-api can grow a
  // calculator faster than a frontend learns to describe one, and its own id is never wrong.
  const known = (["uniform", "weighted", "universal"] as const).find(
    (name) => name === scoreConfig.calculator,
  );

  const weights =
    scoreConfig.calculator === "weighted"
      ? ((scoreConfig.config as { testWeights?: Record<string, number> } | null)?.testWeights ??
        null)
      : null;

  // Only the universal calculator's `config` is an expression tree. A malformed one is somebody
  // else's stored data, so printing it is allowed to fail without taking the page with it.
  let expression: string | null = null;
  if (scoreConfig.calculator === "universal") {
    try {
      expression = printScoreExpression(scoreConfig.config as ScoreNode);
    } catch {
      expression = null;
    }
  }

  return (
    <details className="rounded-lg border border-border bg-card p-3 text-sm">
      <summary className="cursor-pointer font-medium">{t("heading")}</summary>
      <div className="mt-3 flex flex-col gap-2">
        <p className="text-muted-foreground">
          {known ? t(`calculators.${known}`) : scoreConfig.calculator}
        </p>

        {weights !== null && Object.keys(weights).length > 0 && (
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{t("weightsCaption")}</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-1 text-left font-medium">
                  {t("test")}
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {t("weight")}
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(weights).map(([test, weight]) => (
                <tr key={test} className="border-b border-border last:border-0">
                  <td className="py-1">{test}</td>
                  <td className="py-1 text-right tabular-nums">{weight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {expression !== null && (
          <pre className="overflow-x-auto rounded-md bg-muted/40 p-2 text-xs">{expression}</pre>
        )}
      </div>
    </details>
  );
}
