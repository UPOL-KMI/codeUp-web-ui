import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CodeViewer } from "@/components/code/code-viewer";
import { Markdown } from "@/components/markdown/markdown";
import { DateTime } from "@/components/format/date-time";
import { EvaluationBadge } from "@/components/status/evaluation-badge";
import { EvaluationResults } from "@/components/solutions/evaluation-results";
import { DesignSystemShowcase } from "@/components/dev/design-system";
import { PageShell } from "@/components/page-shell";

const SAMPLE_CODE = `# Iterative Fibonacci -- deliberately unremarkable sample code.
def fib(n: int) -> int:
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a


if __name__ == "__main__":
    print([fib(n) for n in range(10)])
`;

const SAMPLE_TIMESTAMP = Date.parse("2026-09-01T21:59:00Z") / 1000;

/**
 * The one state this deployment cannot produce (DEC-031): its sandbox never runs, so no solution
 * here has ever carried a test result and the table G-004 finished has no live fixture to be read
 * against. These rows are the exit-code cases, which is what that ticket added -- a code the
 * environment names, one it does not, a process killed by a signal, a code the sandbox produced
 * rather than the program, and a non-zero code the exercise itself accepts.
 */
const SAMPLE_TEST_RESULT = {
  status: "FAILED",
  score: 0,
  memoryExceeded: false,
  wallTimeExceeded: false,
  cpuTimeExceeded: false,
  exitCode: 0,
  exitCodeOk: false,
  exitCodeNative: true,
  exitSignal: null,
  message: null,
  wallTime: null,
  cpuTime: null,
  memory: null,
  wallTimeRatio: null,
  cpuTimeRatio: null,
  memoryRatio: null,
  judgeLogStdout: null,
  judgeLogStderr: null,
};

const SAMPLE_EVALUATION = {
  evaluation: {
    evaluatedAt: SAMPLE_TIMESTAMP,
    score: 0.25,
    points: 3,
    initFailed: false,
    initiationOutputs: null,
    testResults: [
      {
        ...SAMPLE_TEST_RESULT,
        id: 1,
        testName: "passes",
        status: "OK",
        score: 1,
        exitCode: 0,
        exitCodeOk: true,
      },
      { ...SAMPLE_TEST_RESULT, id: 2, testName: "divides by zero", exitCode: 110 },
      { ...SAMPLE_TEST_RESULT, id: 3, testName: "returns a code nobody named", exitCode: 42 },
      {
        ...SAMPLE_TEST_RESULT,
        id: 4,
        testName: "killed by a signal",
        exitCode: -1,
        exitCodeNative: false,
        exitSignal: 11,
      },
      {
        ...SAMPLE_TEST_RESULT,
        id: 5,
        testName: "never ran",
        status: "SKIPPED",
        exitCode: -1,
        exitCodeNative: false,
      },
      {
        ...SAMPLE_TEST_RESULT,
        id: 6,
        testName: "an exit code this exercise accepts",
        status: "OK",
        score: 1,
        exitCode: 3,
        exitCodeOk: true,
      },
    ],
  },
  failure: null,
};

const SAMPLE_MARKDOWN = [
  "## Assignment",
  "",
  "Implement `fib(n)` so that it runs in **O(n)** time. See <https://recodex.mff.cuni.cz> for the",
  "submission rules.",
  "",
  "The closed form is",
  "",
  "$$F_n = \\frac{\\varphi^n - \\psi^n}{\\varphi - \\psi}$$",
  "",
  "where $\\varphi$ is the golden ratio. A correct solution is worth $10 and $5 in bonus points --",
  "prices like those must stay prose, not turn into mathematics.",
  "",
  "| n | F(n) |",
  "| - | ---- |",
  "| 1 | 1    |",
  "| 7 | 13   |",
  "",
  "```python",
  "print(fib(7))",
  "```",
  "",
  "> Raw HTML such as <b>this</b> is shown as written, never executed.",
].join("\n");

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "DesignSystem" });
  return { title: t("title") };
}

/**
 * \`/dev/design-system\` (D-013): every Design System component rendered in isolation, on one page,
 * in the current theme and locale. Its job is to make a component's real behaviour observable --
 * by a reviewer, and by whoever is building the next one -- without standing up the feature screen
 * that will eventually consume it. D-003 through D-006 each had to build a throwaway demo page to
 * verify anything; this route is what replaces that.
 *
 * The backlog calls this ticket \`/dev/kitchen-sink\`, the term Storybook/MUI/Bootstrap all use for
 * this kind of page. Renamed at the operator's request after they read the route and could not
 * tell what it was -- which is the only test of a name that matters. \`/dev/\` still marks it as
 * tooling rather than product; \`design-system\` says what it holds.
 *
 * Deliberately **outside** both route groups and listed in \`proxy.ts\`'s \`PUBLIC_PATHNAMES\`: it
 * renders no user data and calls no user-scoped endpoint, so requiring a session would only make
 * it harder to look at. The one exception is the upload section, which does talk to core-api and
 * therefore only functions for a signed-in viewer -- the section says so itself rather than
 * failing mysteriously.
 *
 * Not a Server Component boundary violation to have the interactive parts here: the page is a
 * Server Component and \`<DesignSystemShowcase>\` is the single \`"use client"\` island (brief §6.4).
 */
export default async function DesignSystemPage() {
  const t = await getTranslations("DesignSystem");

  return (
    <PageShell title={t("title")} subtitle={t("subtitle")} breadcrumbs={[{ label: t("title") }]}>
      {/* CodeViewer is a Server Component and the showcase is a client island, so it is rendered
          here and passed down as a prop -- the standard way to keep server-only work (here:
          Shiki's grammars and theme JSON) out of the client bundle entirely. Demonstrating that
          composition is half the point of showing it on this page. */}
      <DesignSystemShowcase
        codeSample={<CodeViewer filename="fibonacci.py" code={SAMPLE_CODE} />}
        markdownSample={<Markdown source={SAMPLE_MARKDOWN} />}
        dateSamples={
          <>
            <DateTime unixSeconds={SAMPLE_TIMESTAMP} />
            <DateTime unixSeconds={SAMPLE_TIMESTAMP} dateOnly />
            <DateTime unixSeconds={SAMPLE_TIMESTAMP} withSeconds />
          </>
        }
        evaluationTable={<EvaluationResults solution={SAMPLE_EVALUATION} environment="python3" />}
        evaluationBadges={
          <>
            <EvaluationBadge
              solution={{ lastSubmission: { evaluation: { score: 1 } }, maxPoints: 10 }}
            />
            <EvaluationBadge
              solution={{ lastSubmission: { evaluation: { score: 0.5 } }, maxPoints: 10 }}
            />
            <EvaluationBadge
              solution={{ lastSubmission: { evaluation: { score: 0 } }, maxPoints: 10 }}
            />
            <EvaluationBadge
              solution={{
                lastSubmission: { evaluation: { initFailed: true, score: 0 } },
                maxPoints: 10,
              }}
            />
            <EvaluationBadge solution={{ lastSubmission: {}, maxPoints: 10 }} />
            <EvaluationBadge solution={{ lastSubmission: null, maxPoints: 10 }} />
            <EvaluationBadge
              solution={{ lastSubmission: { evaluation: { score: 1 } }, maxPoints: 0 }}
            />
          </>
        }
      />
    </PageShell>
  );
}
