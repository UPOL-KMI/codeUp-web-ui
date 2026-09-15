import { getTranslations } from "next-intl/server";

import {
  assignmentProgress,
  ASSIGNMENT_PROGRESS_TONE,
  type AssignmentProgressInput,
} from "@/lib/status/assignment-progress";

import { Badge } from "./badge";
import { Hint } from "@/components/status/hint";

/**
 * `EvaluationBadge`'s counterpart for a stats row rather than a solution (S-001) -- same states,
 * same tones, same `Status.evaluation.*` strings, so a dashboard row and a solution page label
 * the identical outcome identically. All branching lives in `lib/status/assignment-progress.ts`
 * and is unit-tested there.
 */
export async function AssignmentProgressBadge({ stats }: { stats: AssignmentProgressInput }) {
  const t = await getTranslations("Status");
  const state = assignmentProgress(stats);

  return (
    <Hint text={t(`evaluation.${state}.description`)} plain>
      <Badge tone={ASSIGNMENT_PROGRESS_TONE[state]}>{t(`evaluation.${state}.label`)}</Badge>
    </Hint>
  );
}
