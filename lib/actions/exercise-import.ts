"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiGet, apiPost } from "@/lib/api/client";
import { readSimpleConfig } from "@/lib/exercise-config/simple-config";
import type { EnvironmentConfig, ExerciseConfig, ExerciseTest } from "@/lib/exercise-config/types";
import type { ActionResult } from "@/lib/forms/action-result";

import {
  updateExerciseConfig,
  updateExerciseEnvironments,
  updateExerciseTests,
} from "./exercise-config";
import { attachExerciseFiles } from "./exercise-files";

/**
 * Creating an exercise out of a GitHub Classroom assignment (X-001).
 *
 * **Assembled from the actions the configuration screens already use**, not from raw endpoints, and
 * the first draft of this proved why. Written by hand against `POST /exercises/{id}/config` it got
 * three things wrong that only a live read of a working exercise showed: a test's variables nest
 * inside `pipelines[]` rather than sitting on the test, a test is identified in the configuration
 * by its **numeric id** rather than its name, and an environment with an empty `variablesTable`
 * declares no `source-files` -- so `pre-submit` matches nothing and the submit form has no
 * environment to offer, which is the trap the seed's own comment describes at length. Going through
 * `updateExerciseConfig` avoids all three: it resolves the environment's pipelines, asks core-api
 * which variables each declares, and merges over a fresh read.
 *
 * **The order is the requirement.** A test's configuration cannot be written before the test
 * exists; the configuration names files, so the files must be attached first; and the score weights
 * are keyed by test *name*, so they go in the same call that creates the tests.
 *
 * It is **not** a transaction, and does not pretend to be. core-api has no such thing across six
 * endpoints, and deleting a partly built exercise on a transient failure would throw away the
 * author's import. Instead it reports which step failed and names the exercise it left behind --
 * every screen needed to finish it or delete it is already built.
 *
 * **The parsing is not here.** `lib/import/classroom.ts` is a pure module with unit tests and the
 * browser runs it to show the author what would happen *before* this is called, so what arrives is
 * a decision rather than a file.
 *
 * The result is deliberately not assignable: core-api refuses an exercise with no reference
 * solution (T-011), which a Classroom template does not carry.
 */

/** One test to create. The two halves are already uploaded through S-014's chunked route. */
export interface ImportedTestInput {
  name: string;
  weight: number;
  judgeType: string;
  stdinFileName: string;
  expectedFileName: string;
}

export interface ClassroomImportInput {
  groupId: string;
  name: string;
  /** The exercise text, usually the template repo's README. May be empty. */
  text: string;
  /** A runtime environment id this deployment has; the caller offers only installed ones. */
  environment: string;
  /** Ids of the files already uploaded, in the order the tests reference them by name. */
  uploadedFileIds: string[];
  tests: ImportedTestInput[];
}

export async function importClassroomExercise(
  input: ClassroomImportInput,
): Promise<ActionResult<{ id: string }>> {
  const t = await getTranslations("ExerciseImport.errors");
  if (input.groupId.trim() === "") return { success: false, formError: t("noGroup") };
  if (input.name.trim() === "") return { success: false, formError: t("noName") };
  if (input.environment.trim() === "") return { success: false, formError: t("noEnvironment") };
  if (input.tests.length === 0) return { success: false, formError: t("noTests") };

  let step = "create";
  let exerciseId: string | null = null;
  try {
    const created = await apiPost<{ id: string }>("/v1/exercises", { groupId: input.groupId });
    exerciseId = created.id;

    step = "settings";
    // Read back rather than reusing the creation's own copy: `version` is the optimistic lock and
    // core-api's defaults land between the two calls.
    const fresh = await apiGet<{ version: number }>("/v1/exercises/{id}", {
      pathParams: { id: exerciseId },
    });
    await apiPost(
      "/v1/exercises/{id}",
      {
        version: fresh.version,
        difficulty: "easy",
        localizedTexts: [
          { locale: "en", name: input.name.trim(), text: input.text, description: "", link: "" },
        ],
        // Imported closed: it has no reference solution, so it cannot be assigned, and publishing
        // an exercise nobody can assign only puts it in everyone's catalog.
        isPublic: false,
        isLocked: true,
        mergeJudgeLogs: true,
        solutionFilesLimit: null,
        solutionSizeLimit: null,
      },
      { pathParams: { id: exerciseId } },
    );

    step = "environment";
    const environments = await updateExerciseEnvironments(exerciseId, {
      environments: [input.environment],
    });
    if (!environments.success) throw new Error(environments.formError);

    step = "files";
    const files = await attachExerciseFiles(exerciseId, input.uploadedFileIds);
    if (!files.success) throw new Error(files.formError);

    step = "tests";
    const tests = await updateExerciseTests(exerciseId, {
      calculator: "weighted",
      tests: input.tests.map((test) => ({ id: null, name: test.name, weight: test.weight })),
    });
    if (!tests.success) throw new Error(tests.formError);

    step = "config";
    const [config, savedTests, savedEnvironments] = await Promise.all([
      apiGet<ExerciseConfig>("/v1/exercises/{id}/config", { pathParams: { id: exerciseId } }),
      apiGet<ExerciseTest[]>("/v1/exercises/{id}/tests", { pathParams: { id: exerciseId } }),
      apiGet<EnvironmentConfig[]>("/v1/exercises/{id}/environment-configs", {
        pathParams: { id: exerciseId },
      }),
    ]);
    const environmentIds = savedEnvironments.map((entry) => entry.runtimeEnvironmentId);
    const values = readSimpleConfig(config ?? [], savedTests, environmentIds);
    // Matched by name, not by position: `POST /tests` answers with the whole set and promises no
    // order, and the names are this import's own so they are a reliable key.
    const wanted = new Map(input.tests.map((test) => [test.name, test]));
    const byId = new Map(savedTests.map((test) => [String(test.id), test.name]));
    for (const test of values.tests) {
      const source = wanted.get(byId.get(test.id) ?? "");
      if (!source) continue;
      test.stdinFile = source.stdinFileName;
      test.expectedOutput = source.expectedFileName;
      test.judgeType = source.judgeType;
      test.useCustomJudge = false;
    }
    const written = await updateExerciseConfig(exerciseId, values);
    if (!written.success) throw new Error(written.formError);

    return { success: true, data: { id: exerciseId } };
  } catch (error) {
    return {
      success: false,
      formError: t("stepFailed", {
        step: t(`steps.${step}`),
        reason:
          error instanceof ApiError
            ? error.message
            : error instanceof Error && error.message !== ""
              ? error.message
              : t("unknown"),
        exercise: exerciseId ?? t("nothingCreated"),
      }),
    };
  }
}
