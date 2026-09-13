import { test, expect } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

import { STUDENT, SUPERVISOR } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import { eraseReviewIfPresent, restoreSeededReviewRequest } from "./helpers/core-api";
import { cleanUpCreated } from "./helpers/created";
import type { SeedAccount } from "./helpers/accounts";

/**
 * The solution source viewer (S-017) and the review written on top of it (S-018).
 *
 * The review test runs as **two people in two browser contexts**, because that is the only way to
 * check the rule that matters: a comment written by a supervisor is invisible to the author until
 * the review is closed. Asserting it from the supervisor's own session would prove nothing.
 *
 * It writes real data on the instance (a review on a seeded solution) and erases it again at the
 * end, so a re-run starts from the same state -- the same discipline the seed script follows.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

/**
 * Finds the sources page of the seeded solution whose code contains `marker`, by walking the
 * student's assignments and their attempts.
 *
 * Deliberately not "the first row of the dashboard": the submit spec adds solutions, this suite
 * deletes none, and the assignment a student owes next changes with the calendar -- so anything
 * positional here is a test that passes until someone runs the suite twice. The seeded contents
 * are distinct on purpose (`docs/SEED_ACCOUNTS.md`), which makes them a usable key.
 */
async function openSourcesContaining(page: Page, marker: string): Promise<void> {
  await page.getByRole("main").locator("tbody tr a").first().waitFor();
  const assignments = await page
    .getByRole("main")
    .locator("tbody tr a")
    .evaluateAll((links) => [
      ...new Set(
        links
          .map((link) => (link as HTMLAnchorElement).pathname)
          .filter((path) => /\/assignments\/[0-9a-f-]+$/.test(path)),
      ),
    ]);

  for (const assignment of assignments) {
    await page.goto(`${assignment}?tab=solutions`);
    // `evaluateAll` does not auto-wait, and `goto` resolves while the route's `loading.tsx`
    // skeleton is still what is on screen -- so the list has to be waited for explicitly or this
    // reads zero attempts from a page that has plenty. (Found live: it passed against `next dev`
    // and failed against a production build, which streams differently.)
    await page.getByRole("main").getByRole("heading", { name: "My solutions" }).waitFor();
    const attempts = await page
      .getByRole("main")
      .getByRole("link", { name: /^Attempt \d+$/ })
      .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).pathname));

    for (const attempt of attempts) {
      await page.goto(`${attempt}/sources`);
      // Waited for explicitly: `goto` resolves on load, and reading `innerText` before the page
      // has rendered returns an empty string that looks exactly like "no match".
      const main = page.getByRole("main");
      await main.getByRole("heading", { name: "Source code" }).waitFor();
      // The heading is **not** enough, and believing it was cost a day of chasing a phantom
      // regression: the files stream in behind their own `<Suspense>`, whose fallback is a
      // skeleton with no text at all. On a busy instance this read the fallback and reported "no
      // match" for a solution that plainly contains the marker. Wait for the skeleton to go.
      await main
        .locator('[data-slot="skeleton"]')
        .first()
        .waitFor({ state: "detached" })
        .catch(() => undefined);
      // `innerText`, not `getByText`: Shiki splits a line into one span per token, so no single
      // element directly contains `print("...")` -- Playwright's text engine would never match it.
      if ((await main.innerText()).includes(marker)) return;
    }
  }
  throw new Error(`no solution of this student contains '${marker}'`);
}

test("a student reads the files they submitted, line by line", async ({ page }) => {
  await signIn(page, STUDENT, "/en/dashboard");
  await openSourcesContaining(page, 'print("Hello, ReCodEx!")');

  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Source code" })).toBeVisible();
  await expect(main.getByText("solution.py", { exact: true })).toBeVisible();
  await expect(main).toContainText('print("Hello, ReCodEx!")');

  // Line anchors are per file, so several files on one page do not all claim `#L1`.
  await expect(page.locator("#solution-py-L1")).toBeVisible();

  // Highlighting happens on the server: asserted on the raw HTML, where a client-side highlighter
  // would look identical in the hydrated DOM and prove nothing.
  const html = await (await page.request.get(page.url())).text();
  expect(html).toContain("--shiki-light");
  expect(html).toContain("Hello, ReCodEx!");
});

test("the solution screen links to its own source code", async ({ page }) => {
  await signIn(page, STUDENT, "/en/dashboard");
  await page.getByRole("main").locator("tbody tr").first().getByRole("link").first().click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+$/);
  await page
    .getByRole("main")
    .getByRole("link", { name: /^Attempt \d+$/ })
    .first()
    .click();

  await page.getByRole("link", { name: "Source code" }).click();
  await expect(page).toHaveURL(/\/en\/solutions\/[0-9a-f-]+\/sources$/);
  await expect(page.getByRole("main").getByRole("heading", { name: "Source code" })).toBeVisible();
});

test("a solution of several files reads as each of them", async ({ page }) => {
  // The one genuinely slow test in the suite: it walks the dashboard to find the seeded multi-file
  // submission. It takes ~17s alone and began timing out at the default 30s once the suite grew
  // past two hundred tests sharing this machine's core-api -- slow work, not a hang, so it gets
  // more room rather than a retry.
  //
  // **This fixture used to be a single ZIP archive and cannot be one any more.** core-api matches
  // an exercise's `source-files` wildcard against the *uploaded* names, and `solution.zip` matches
  // no `*.py` pattern, so such a submission is refused outright -- see `scripts/seed.ts`. Several
  // real files exercise the same thing this test is for: one solution, more than one file, each
  // rendered in its own right.
  test.slow();
  await signIn(page, STUDENT, "/en/dashboard");
  await openSourcesContaining(page, "main.py");

  const main = page.getByRole("main");
  await expect(main.getByText("greeting.py").first()).toBeVisible();
  await expect(main).toContainText("from greeting import GREETING");
  // Each file is one in its own right, with its own line anchors.
  await expect(page.locator("#main-py-L1")).toBeVisible();
  await expect(page.locator("#greeting-py-L1")).toBeVisible();
});

// Registered once for the file (PF-014). The test below erases its own review -- that is the last
// thing it asserts -- so this finds nothing to do in the ordinary case; it exists for the run that
// dies in between, which left a review standing and the next run with no "Start review" button to
// press.
const trackReview = cleanUpCreated(eraseReviewIfPresent);

test("a supervisor's review reaches the student only when it is closed", async ({
  browser,
}: {
  browser: Browser;
}) => {
  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();
  await signIn(studentPage, STUDENT, "/en/dashboard");
  await openSourcesContaining(studentPage, 'print("Hello, ReCodEx!")');
  const sourcesUrl = studentPage.url();

  const supervisorContext = await browser.newContext();
  const supervisorPage = await supervisorContext.newPage();
  await signIn(supervisorPage, SUPERVISOR, sourcesUrl);

  const supervisorMain = supervisorPage.getByRole("main");
  // Remembered before the review exists, so the sweep covers the click itself failing part-way.
  trackReview(/\/solutions\/([0-9a-f-]+)/.exec(sourcesUrl)?.[1]);
  await supervisorPage.getByRole("button", { name: "Start review" }).click();
  await expect(supervisorPage.getByRole("button", { name: "Close review" })).toBeVisible();

  // The per-line control is what a keyboard user has; the legacy app's double-click is not.
  await supervisorMain.getByRole("button", { name: "Comment on line 1" }).click();
  await supervisorPage
    .getByPlaceholder("Write a comment on this line")
    .fill("[e2e] Use a constant for the greeting.");
  await supervisorPage.getByLabel("This is an issue to fix").check();
  await supervisorPage.getByRole("button", { name: "Add comment" }).click();
  await expect(supervisorMain.getByText("[e2e] Use a constant for the greeting.")).toBeVisible();

  // The other half of the review surface (the solution as a whole, not a line), and the one that
  // carries markdown: a reviewer's emphasis, list, link and fenced snippet are rendered rather
  // than printed as the characters they were typed as (G-027). It is rendered on the *server* --
  // `Markdown` is async and this whole path is a client island -- so what this proves is that the
  // page's own render reached the island.
  await supervisorMain.getByRole("button", { name: "Add a comment about the solution" }).click();
  await supervisorPage
    .getByPlaceholder("Write a comment on this line")
    .fill(
      "[e2e] **Prefer** `enumerate`.\n\n- shorter\n\n```python\nfor i, x in enumerate(xs):\n    pass\n```",
    );
  await supervisorPage.getByRole("button", { name: "Add comment" }).click();

  const rendered = supervisorMain.locator('[data-slot="markdown"]').filter({ hasText: "Prefer" });
  await expect(rendered).toBeVisible();
  await expect(rendered.locator("strong")).toHaveText("Prefer");
  await expect(rendered.locator("li")).toHaveText("shorter");
  await expect(rendered.locator(".shiki")).toHaveCount(1);
  await expect(rendered).not.toContainText("**Prefer**");

  // Still open: the author must see nothing at all.
  await studentPage.goto(sourcesUrl);
  await expect(
    studentPage.getByRole("main").getByText("[e2e] Use a constant for the greeting."),
  ).toBeHidden();

  await supervisorPage.getByRole("button", { name: "Close review" }).click();
  await expect(supervisorPage.getByRole("button", { name: "Reopen review" })).toBeVisible();

  await studentPage.goto(sourcesUrl);
  const studentMain = studentPage.getByRole("main");
  await expect(studentMain.getByText("[e2e] Use a constant for the greeting.")).toBeVisible();
  await expect(studentMain.getByText("Issue", { exact: true })).toBeVisible();
  await expect(studentMain.getByText(/You have 1 issue to fix/)).toBeVisible();
  // The author may read a review, never write one.
  await expect(studentPage.getByRole("button", { name: "Comment on line 1" })).toBeHidden();

  await supervisorPage.getByRole("button", { name: "Erase review" }).click();
  await supervisorPage.getByRole("button", { name: "Erase review" }).last().click();
  await expect(supervisorPage.getByRole("button", { name: "Start review" })).toBeVisible();

  // **Closing a review withdraws the request, and erasing it does not put the request back.**
  // `AssignmentSolution::setReviewedAt()` clears `reviewRequest` whenever a review is closed --
  // in the entity, so it is invisible in the presenter and in the response. That is the right
  // product behaviour (the teacher has answered) but this solution's request is a *fixture*: the
  // row the teacher dashboard's "reviews students have asked for" queue is read through. Closing
  // a review here consumed it, and the dashboard spec then failed in the other worker (DEC-133).
  await restoreSeededReviewRequest();

  await studentContext.close();
  await supervisorContext.close();
});
