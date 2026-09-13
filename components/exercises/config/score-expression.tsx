"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { updateScoreExpression } from "@/lib/actions/exercise-score";
import {
  extractWeights,
  parseScoreExpression,
  printScoreExpression,
  referencedTests,
  ScoreExpressionError,
  type ScoreNode,
} from "@/lib/exercise-config/score-expression";
import type { ActionResult } from "@/lib/forms/action-result";

import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/toast/toast-provider";

/**
 * The custom score expression (T-025) -- core-api's `universal` calculator, edited as text.
 *
 * The legacy app edits the stored expression *tree* with a tree: three thousand lines of node
 * forms and drag targets. This parses and prints it instead (DEC-109). The grammar is smaller than
 * that editor, an expression can be read at a glance and pasted between exercises, and the whole
 * of it is a pair of pure functions with a round-trip test -- while the tree editor could only be
 * checked by clicking through it.
 *
 * **It parses as you type, and says what is wrong where.** A score expression is not prose: a
 * misspelt test name is not a syntax error, it is an exercise that grades on a test that does not
 * exist, and core-api's own refusal names the calculator rather than the word. So both are checked
 * here -- the syntax by the parser, the names against the exercise's tests -- and the save is not
 * offered until both are clean.
 *
 * **Switching is lossless one way and not the other**, so the two directions read differently.
 * Coming *to* the expression seeds it from what the exercise already does, so it grades exactly as
 * before. Going *back* keeps only what an average can express: where the expression happens to be
 * one, the weights it becomes are named; where it is not, the dialog says it will be lost.
 */
export function ScoreExpressionEditor({
  exerciseId,
  expression,
  testNames,
  readOnly,
}: {
  exerciseId: string;
  /** The stored tree, when the exercise already uses a custom score. */
  expression: ScoreNode | null;
  testNames: string[];
  readOnly: boolean;
}) {
  const t = useTranslations("ExerciseScore");
  const router = useRouter();
  const toast = useToast();

  // The caller renders this only for an exercise that actually uses the expression calculator --
  // every other calculator's stored config is a different shape entirely, and printing one is not
  // a no-op but a crash on the render path, which is why `expression` is typed as the tree or
  // nothing rather than as whatever the score happens to hold.
  const [source, setSource] = useState(() => (expression ? printScoreExpression(expression) : ""));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => {
    if (source.trim() === "") return { tree: null as ScoreNode | null, problem: null };
    try {
      return { tree: parseScoreExpression(source), problem: null };
    } catch (caught) {
      const problem =
        caught instanceof ScoreExpressionError
          ? t(`errors.syntax.${caught.message}`, { at: caught.at + 1 })
          : t("errors.invalid");
      return { tree: null, problem };
    }
  }, [source, t]);

  const known = useMemo(() => new Set(testNames), [testNames]);
  const unknownTests = useMemo(
    () =>
      parsed.tree
        ? [...new Set(referencedTests(parsed.tree).filter((name) => !known.has(name)))]
        : [],
    [parsed.tree, known],
  );
  const unusedTests = useMemo(() => {
    if (!parsed.tree) return [];
    const used = new Set(referencedTests(parsed.tree));
    return testNames.filter((name) => !used.has(name));
  }, [parsed.tree, testNames]);

  const equivalentWeights = useMemo(
    () => (parsed.tree ? extractWeights(parsed.tree) : null),
    [parsed.tree],
  );

  const usable = parsed.tree !== null && unknownTests.length === 0;

  async function run(call: () => Promise<ActionResult<unknown>>, successKey: string) {
    setPending(true);
    setError(null);
    const result = await call();
    setPending(false);
    if (!result.success) {
      setError(result.formError ?? t("errors.invalid"));
      return;
    }
    toast.success(t(successKey));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="flex flex-col gap-1 text-sm">
          {t("expression")}
          <textarea
            rows={4}
            spellCheck={false}
            className="rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring aria-invalid:border-destructive"
            aria-invalid={parsed.problem !== null || unknownTests.length > 0}
            disabled={readOnly}
            value={source}
            onChange={(event) => setSource(event.target.value)}
          />
        </label>
        <p className="text-xs text-muted-foreground">{t("syntax")}</p>
        <p className="text-xs text-muted-foreground">
          {t("tests", { tests: testNames.map((name) => `"${name}"`).join(", ") || "—" })}
        </p>
      </div>

      {parsed.problem && (
        <p role="alert" className="text-sm text-destructive">
          {parsed.problem}
        </p>
      )}
      {unknownTests.length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {t("unknownTests", { tests: unknownTests.join(", ") })}
        </p>
      )}
      {usable && unusedTests.length > 0 && (
        <p className="text-sm text-warning">
          {t("unusedTests", { tests: unusedTests.join(", ") })}
        </p>
      )}
      {usable && equivalentWeights && (
        <p className="text-xs text-muted-foreground">{t("isAnAverage")}</p>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending || !usable}
            onClick={() => void run(() => updateScoreExpression(exerciseId, source), "saved")}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {pending ? t("saving") : t("save")}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
