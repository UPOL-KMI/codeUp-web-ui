"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiGet, apiPost } from "@/lib/api/client";
import type { ActionResult } from "@/lib/forms/action-result";
import {
  expressionFromWeights,
  parseScoreExpression,
  ScoreExpressionError,
} from "@/lib/exercise-config/score-expression";
import type { ExerciseTest } from "@/lib/exercise-config/types";

/**
 * The custom score expression (T-025).
 *
 * core-api's `universal` calculator stores an expression tree over the test results. This writes
 * one, and switches an exercise onto or off the calculator that uses it -- the thing T-009 could
 * show but not edit (DEC-103), and the last of the two doors it left closed.
 *
 * **The expression is parsed here as well as in the form**, and not out of caution: the text is
 * what the reader typed, and a Server Action is a public endpoint that happens to have nice syntax
 * (brief §6). What is sent to core-api is the tree, never the text -- the text is this app's
 * notation and core-api has never heard of it.
 *
 * **A test that does not exist is refused before saving.** core-api validates the expression
 * against the exercise's tests and would refuse it too, but its message names the calculator
 * rather than the word somebody mistyped.
 */
async function failure(error: unknown, fallbackKey: string): Promise<ActionResult<never>> {
  const t = await getTranslations("ExerciseScore.errors");
  return {
    success: false,
    formError: error instanceof ApiError ? error.message : t(fallbackKey),
  };
}

export async function updateScoreExpression(
  exerciseId: string,
  expression: string,
): Promise<ActionResult<{ tests: number }>> {
  const t = await getTranslations("ExerciseScore.errors");

  let tree;
  try {
    tree = parseScoreExpression(expression);
  } catch (error) {
    if (error instanceof ScoreExpressionError) {
      return { success: false, formError: t(`syntax.${error.message}`, { at: error.at + 1 }) };
    }
    return failure(error, "invalid");
  }

  try {
    const tests = await apiGet<ExerciseTest[]>("/v1/exercises/{id}/tests", {
      pathParams: { id: exerciseId },
    });
    const known = new Set(tests.map((test) => test.name));
    const unknown = [...new Set(collectTests(tree).filter((name) => !known.has(name)))];
    if (unknown.length > 0) {
      return { success: false, formError: t("unknownTests", { tests: unknown.join(", ") }) };
    }

    await apiPost(
      "/v1/exercises/{id}/score-config",
      { scoreCalculator: "universal", scoreConfig: tree },
      { pathParams: { id: exerciseId } },
    );
    return { success: true, data: { tests: known.size } };
  } catch (error) {
    return failure(error, "saveFailed");
  }
}

/**
 * Move an exercise onto the custom calculator, seeded from what it already does.
 *
 * Equal weights become a plain average and unequal ones the sum over the total, so switching is
 * **lossless in this direction**: the exercise is graded exactly as it was, in a notation that can
 * now be edited. An exercise with no tests has no expression to seed, and core-api would refuse an
 * empty one.
 */
export async function switchToScoreExpression(
  exerciseId: string,
): Promise<ActionResult<{ expression: unknown }>> {
  const t = await getTranslations("ExerciseScore.errors");
  try {
    const [tests, score] = await Promise.all([
      apiGet<ExerciseTest[]>("/v1/exercises/{id}/tests", { pathParams: { id: exerciseId } }),
      apiGet<{ calculator: string; config: unknown }>("/v1/exercises/{id}/score-config", {
        pathParams: { id: exerciseId },
      }),
    ]);
    if (tests.length === 0) return { success: false, formError: t("noTests") };

    const weights =
      score.calculator === "weighted"
        ? ((score.config as { testWeights?: Record<string, number> } | null)?.testWeights ?? {})
        : {};
    // Sorted by name, so the seeded expression reads in the same order the tests are listed in.
    // core-api returns them in insertion order, which is nobody's idea of an order.
    const seeded = Object.fromEntries(
      [...tests]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((test) => [test.name, weights[test.name] ?? 100]),
    );

    const tree = expressionFromWeights(seeded);
    if (!tree) return { success: false, formError: t("noTests") };

    await apiPost(
      "/v1/exercises/{id}/score-config",
      { scoreCalculator: "universal", scoreConfig: tree },
      { pathParams: { id: exerciseId } },
    );
    return { success: true, data: { expression: tree } };
  } catch (error) {
    return failure(error, "saveFailed");
  }
}

/** Back to one of the two averages. What that costs is worked out in the form, not here. */
export async function switchFromScoreExpression(
  exerciseId: string,
  calculator: "uniform" | "weighted",
  testWeights: Record<string, number>,
): Promise<ActionResult<{ calculator: string }>> {
  try {
    await apiPost(
      "/v1/exercises/{id}/score-config",
      {
        scoreCalculator: calculator,
        scoreConfig: calculator === "weighted" ? { testWeights } : null,
      },
      { pathParams: { id: exerciseId } },
    );
    return { success: true, data: { calculator } };
  } catch (error) {
    return failure(error, "saveFailed");
  }
}

function collectTests(node: unknown): string[] {
  if (!node || typeof node !== "object") return [];
  const current = node as { type?: string; test?: string; children?: unknown[] };
  if (current.type === "test-result" && current.test) return [current.test];
  return (current.children ?? []).flatMap(collectTests);
}
