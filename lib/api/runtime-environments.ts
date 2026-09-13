import "server-only";

import { cache } from "react";

import { apiRead } from "./read";

/**
 * The instance's runtime environments -- the languages an exercise can be written for.
 *
 * A fixed, instance-wide list (`python3`, `java`, ...), which is why it is memoized per request:
 * the assignment screen wants the names, the exercise catalog wants them as filter options, and
 * both are read on the same render often enough to matter.
 */
export interface RuntimeEnvironment {
  id: string;
  name: string;
  /**
   * The longer name core-api also carries ("Data-Only" where `name` is "Data"). Optional because
   * nothing guarantees it is set; callers fall back to `name`, and both beat showing the id.
   */
  longName?: string;
}

export const getRuntimeEnvironments = cache(async function getRuntimeEnvironments(): Promise<
  RuntimeEnvironment[]
> {
  const environments = await apiRead<RuntimeEnvironment[]>("/v1/runtime-environments");
  return environments.sort((a, b) => a.name.localeCompare(b.name));
});

/** The same list as an id → name lookup. */
export async function environmentNames(): Promise<Map<string, string>> {
  const environments = await getRuntimeEnvironments();
  return new Map(environments.map((environment) => [environment.id, environment.name]));
}
