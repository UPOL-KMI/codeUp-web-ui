"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiDelete, apiGet, apiPost } from "@/lib/api/client";
import type { ActionResult } from "@/lib/forms/action-result";
import type { PipelineStructure } from "@/lib/pipelines/types";

import {
  pipelineSettingsSchema,
  structureSchema,
  type PipelineSettingsValues,
  type StructureValues,
} from "./pipeline.schema";

/**
 * Everything that changes a pipeline (T-015/T-016).
 *
 * **`version` is the optimistic lock and it is not optional**, the shape DEC-092 records for an
 * assignment: core-api replaces the pipeline with what it is sent, and two people editing the same
 * one would otherwise silently overwrite each other. Its `400-010` is surfaced as it came rather
 * than retried -- the honest answer is to reload and look at what changed.
 *
 * **The settings save and the structure save both go through `updatePipeline`**, which takes the
 * whole entity. So each carries the *other's* current value, read fresh: sending the settings form
 * without `pipeline` would be read by core-api as "no change" only because the field is optional,
 * and relying on that is one refactor away from wiping a colleague's structure.
 *
 * Runtime environments are a separate call and deliberately so -- core-api's own
 * `updateRuntimeEnvironments` recomputes which exercises a pipeline can serve.
 */
interface PipelinePayload {
  version: number;
  name: string;
  description: string;
  pipeline: PipelineStructure;
  parameters?: Record<string, boolean>;
}

async function failure(error: unknown, fallbackKey: string): Promise<ActionResult<never>> {
  const t = await getTranslations("PipelineEdit.errors");
  return {
    success: false,
    formError: error instanceof ApiError ? error.message : t(fallbackKey),
  };
}

const read = (id: string) => apiGet<PipelinePayload>("/v1/pipelines/{id}", { pathParams: { id } });

export async function updatePipelineSettings(
  pipelineId: string,
  values: PipelineSettingsValues,
): Promise<ActionResult<{ version: number }>> {
  const t = await getTranslations("PipelineEdit.errors");
  const parsed = pipelineSettingsSchema.safeParse(values);
  if (!parsed.success) return { success: false, formError: t("invalid") };

  try {
    const current = await read(pipelineId);
    const saved = await apiPost<PipelinePayload>(
      "/v1/pipelines/{id}",
      {
        version: parsed.data.version,
        name: parsed.data.name.trim(),
        description: parsed.data.description,
        parameters: parsed.data.parameters,
        // Carried, not omitted: this endpoint replaces the pipeline with what it is sent.
        pipeline: current.pipeline,
      },
      { pathParams: { id: pipelineId } },
    );
    return { success: true, data: { version: saved.version } };
  } catch (error) {
    return failure(error, "settingsFailed");
  }
}

export async function updatePipelineStructure(
  pipelineId: string,
  values: StructureValues,
): Promise<ActionResult<{ version: number }>> {
  const t = await getTranslations("PipelineEdit.errors");
  const parsed = structureSchema.safeParse(values);
  if (!parsed.success) return { success: false, formError: t("invalid") };

  const names = parsed.data.boxes.map((box) => box.name.trim());
  if (new Set(names).size !== names.length) {
    return { success: false, formError: t("duplicateBox") };
  }
  const variableNames = parsed.data.variables.map((variable) => variable.name.trim());
  if (new Set(variableNames).size !== variableNames.length) {
    return { success: false, formError: t("duplicateVariable") };
  }

  try {
    const current = await read(pipelineId);
    const saved = await apiPost<PipelinePayload>(
      "/v1/pipelines/{id}",
      {
        version: parsed.data.version,
        name: current.name,
        description: current.description,
        parameters: current.parameters ?? {},
        pipeline: { boxes: parsed.data.boxes, variables: parsed.data.variables },
      },
      { pathParams: { id: pipelineId } },
    );
    return { success: true, data: { version: saved.version } };
  } catch (error) {
    return failure(error, "structureFailed");
  }
}

export async function updatePipelineEnvironments(
  pipelineId: string,
  environmentIds: string[],
): Promise<ActionResult<{ count: number }>> {
  try {
    await apiPost(
      "/v1/pipelines/{id}/runtime-environments",
      { environments: environmentIds },
      { pathParams: { id: pipelineId } },
    );
    return { success: true, data: { count: environmentIds.length } };
  } catch (error) {
    return failure(error, "environmentsFailed");
  }
}

export async function createPipeline(): Promise<ActionResult<{ id: string }>> {
  try {
    const created = await apiPost<{ id: string }>("/v1/pipelines", {});
    return { success: true, data: { id: created.id } };
  } catch (error) {
    return failure(error, "createFailed");
  }
}

export async function forkPipeline(pipelineId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const forked = await apiPost<{ id: string }>(
      "/v1/pipelines/{id}/fork",
      {},
      { pathParams: { id: pipelineId } },
    );
    return { success: true, data: { id: forked.id } };
  } catch (error) {
    return failure(error, "forkFailed");
  }
}

export async function deletePipeline(pipelineId: string): Promise<ActionResult<{ id: string }>> {
  try {
    await apiDelete("/v1/pipelines/{id}", { pathParams: { id: pipelineId } });
    return { success: true, data: { id: pipelineId } };
  } catch (error) {
    return failure(error, "deleteFailed");
  }
}
