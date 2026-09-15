import { getTranslations } from "next-intl/server";

import { EVALUATION_TONE, evaluationStatus, type EvaluationInput } from "@/lib/status/evaluation";

import { Badge } from "./badge";
import { Hint } from "@/components/status/hint";

/**
 * Renders a solution's evaluation state (D-011). All of the branching lives in
 * `lib/status/evaluation.ts` and is unit-tested there; this component only turns the resulting
 * state into a label and a tone, so a badge, a table row and a detail header can never disagree
 * about what a solution's state is.
 *
 * A Server Component: nothing here is interactive, and the state is derived entirely from data the
 * page already fetched.
 */
export async function EvaluationBadge({ solution }: { solution: EvaluationInput }) {
  const t = await getTranslations("Status");
  const status = evaluationStatus(solution);

  return (
    <Hint text={t(`evaluation.${status}.description`)} plain>
      <Badge tone={EVALUATION_TONE[status]}>{t(`evaluation.${status}.label`)}</Badge>
    </Hint>
  );
}
