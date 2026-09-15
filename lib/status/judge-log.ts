/**
 * Whether a judge's log is one of ReCodEx's token judges, and therefore worth a legend.
 *
 * **The log reaches the screen exactly as the judge wrote it**, and its notation is not guessable:
 * `-1/+1: [16]started.. != [16]started..?` reads like an error in the tool. It is not -- it is a
 * diff, where `[16]` is a *column*, not a token index. The operator asked what it meant, which is
 * the answer this legend exists to give.
 *
 * Every shape comes from `judges/recodex_token_judge/` in the worker repository:
 *
 * - `-N: <line>`    an expected line with no counterpart (`judge.hpp:278`)
 * - `+N: <line>`    a produced line with no counterpart (`judge.hpp:287`)
 * - `-N/+M:`        expected line N against produced line M (`comparator.hpp:614`)
 * - `[N]a != [N]b`  the token at column N differs (`comparator.hpp:505`)
 * - `-[N]a`         that token is missing, `+[N]b` it is extra (`comparator.hpp:491`)
 *
 * **Detected from the text, not from the exercise's configuration.** The solution screen is given
 * the log and the test's result, never which judge was configured -- and an exercise can carry a
 * custom judge whose output means something else entirely. Recognising the notation is the only
 * honest test: a legend over a log it does not describe would be worse than none.
 */
const PAIRED_LINES = /^-\d+\/\+\d+:/m;
const IMPAIRED_LINE = /^[-+]\d+: /m;

export function isTokenJudgeLog(log: string): boolean {
  return PAIRED_LINES.test(log) || IMPAIRED_LINE.test(log);
}
