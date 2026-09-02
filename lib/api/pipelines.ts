import "server-only";

import { localizedName, type LocalizedText } from "@/lib/i18n-text/localized";

import { apiGet, apiPost } from "./client";
import { pageRead } from "./read";
import { getRuntimeEnvironments } from "./runtime-environments";
import type { BoxType, PipelineDetail, PipelineStructure } from "@/lib/pipelines/types";

/**
 * The instance's pipelines (T-013/T-014).
 *
 * A pipeline is the machinery an exercise's tests run on: a dataflow graph of boxes -- compile
 * this, execute that, judge the output -- wired together by named variables. Exercise authors do
 * not usually write one; they pick from what the instance offers, which is what T-009's
 * configuration editor does. This block is for whoever maintains the instance's own.
 *
 * **The list is core-api's, paged and searched there** -- the same trade T-020 records for the
 * exercise catalog. It is a smaller list (fifteen on this deployment) but the endpoint offers
 * `filters[search]`, `orderBy`, `offset` and `limit`, and a narrowed view being a shareable URL is
 * worth more than saving a request.
 *
 * Listing them at all is `canViewAll`, which a supervisor holds -- verified live, and the reason
 * T-009's configuration editor can read the catalogue without being an administrator's screen.
 */
export interface PipelineRow {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  authorName: string | null;
  runtimeEnvironmentIds: string[];
  environmentNames: string[];
  parameters: string[];
  can: Record<string, boolean>;
}

interface PipelinePayload {
  id: string;
  name: string;
  version: number;
  description: string;
  createdAt: number;
  updatedAt: number;
  author: string | null;
  forkedFrom: string | null;
  pipeline: PipelineStructure;
  parameters?: Record<string, boolean>;
  runtimeEnvironmentIds?: string[];
  supplementaryFilesIds?: string[];
  permissionHints?: Record<string, boolean>;
}

export interface PipelineCatalog {
  items: PipelineRow[];
  total: number;
  offset: number;
  limit: number;
}

export interface PipelineQuery {
  search?: string;
  environment?: string;
  offset?: number;
  limit?: number;
  orderBy?: string;
}

export const PIPELINE_PAGE_SIZE = 25;

async function nameAuthors(ids: (string | null)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((id): id is string => !!id))];
  if (wanted.length === 0) return new Map();
  const people = await apiPost<{ id: string; fullName: string }[]>("/v1/users/list", {
    ids: wanted,
  });
  return new Map(people.map((person) => [person.id, person.fullName]));
}

/** The flags a pipeline declares about itself, as a list of the ones that are on. */
function activeParameters(parameters: Record<string, boolean> | undefined): string[] {
  return Object.entries(parameters ?? {})
    .filter(([, value]) => value)
    .map(([name]) => name)
    .sort();
}

export async function getPipelineCatalog(query: PipelineQuery): Promise<PipelineCatalog> {
  const limit = query.limit ?? PIPELINE_PAGE_SIZE;
  const offset = query.offset ?? 0;

  const result = await pageRead(
    apiGet<{ items: PipelinePayload[]; totalCount: number }>("/v1/pipelines", {
      query: {
        offset,
        limit,
        ...(query.orderBy ? { orderBy: query.orderBy } : {}),
        ...(query.search ? { "filters[search]": query.search } : {}),
      },
    }),
  );

  const [authors, environments] = await Promise.all([
    nameAuthors(result.items.map((pipeline) => pipeline.author)),
    getRuntimeEnvironments(),
  ]);
  const environmentNames = new Map(environments.map((entry) => [entry.id, entry.name]));

  // core-api's pipeline filter has no runtime-environment clause (only `search`, `exerciseId` and
  // `authorId` -- read from the presenter, not guessed), so narrowing by language is done here,
  // over the page. It is stated on the screen rather than pretended away: on a paged list a
  // client-side filter can only narrow what this page holds.
  const items = result.items
    .filter(
      (pipeline) =>
        !query.environment || (pipeline.runtimeEnvironmentIds ?? []).includes(query.environment),
    )
    .map((pipeline) => ({
      id: pipeline.id,
      name: pipeline.name,
      description: pipeline.description,
      createdAt: pipeline.createdAt,
      updatedAt: pipeline.updatedAt,
      authorName: pipeline.author ? (authors.get(pipeline.author) ?? null) : null,
      runtimeEnvironmentIds: pipeline.runtimeEnvironmentIds ?? [],
      environmentNames: (pipeline.runtimeEnvironmentIds ?? []).map(
        (id) => environmentNames.get(id) ?? id,
      ),
      parameters: activeParameters(pipeline.parameters),
      can: pipeline.permissionHints ?? {},
    }));

  return { items, total: result.totalCount, offset, limit };
}

export async function getPipeline(pipelineId: string): Promise<PipelineDetail> {
  const pipeline = await pageRead(
    apiGet<PipelinePayload>("/v1/pipelines/{id}", { pathParams: { id: pipelineId } }),
  );
  const authors = await nameAuthors([pipeline.author]);

  return {
    id: pipeline.id,
    name: pipeline.name,
    version: pipeline.version,
    description: pipeline.description,
    createdAt: pipeline.createdAt,
    updatedAt: pipeline.updatedAt,
    author: pipeline.author,
    authorName: pipeline.author ? (authors.get(pipeline.author) ?? null) : null,
    forkedFrom: pipeline.forkedFrom,
    pipeline: pipeline.pipeline,
    parameters: pipeline.parameters ?? {},
    runtimeEnvironmentIds: pipeline.runtimeEnvironmentIds ?? [],
    supplementaryFilesIds: pipeline.supplementaryFilesIds ?? [],
    can: pipeline.permissionHints ?? {},
  };
}

/** The box types the instance offers -- the vocabulary a structure editor builds from. */
export async function getBoxTypes(): Promise<BoxType[]> {
  const boxes = await apiGet<BoxType[]>("/v1/pipelines/boxes");
  return [...boxes].sort(
    (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  );
}

/** The exercises using a pipeline -- what would break if it changed. */
export async function getPipelineExercises(
  pipelineId: string,
  locale: string,
): Promise<{ id: string; name: string }[]> {
  const exercises = await apiGet<{ id: string; localizedTexts?: LocalizedText[] }[]>(
    "/v1/pipelines/{id}/exercises",
    { pathParams: { id: pipelineId } },
  );
  return exercises
    .map((exercise) => ({ id: exercise.id, name: localizedName(exercise.localizedTexts, locale) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
