import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { SUPERADMIN, SUPERVISOR } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import { deleteSubmissionIfPresent, mintSubmissionFailure } from "./helpers/core-api";

/**
 * Submissions that never became a result (T-019).
 *
 * This dev machine is the perfect fixture: its sandbox cannot run at all (DEC-031), so every
 * submission ever made here is in this list.
 *
 * **Resolving one is permanent -- core-api has no un-resolve -- so the write test makes its own
 * failure rather than taking one from the queue (PF-006).** It used to take the oldest row, on the
 * reasoning that the submit spec mints a fresh one every run. That stopped being true when the
 * submit spec started deleting the solution it creates, because a deleted solution takes its
 * failures with it: the queue then drained by one per run until it was empty, and three tests in
 * this file went red for a reason that had nothing to do with them. A test that consumes shared
 * state has to replace it, and the cheapest way to make a failure here is to re-run a seeded
 * solution and let the sandbox refuse it.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

test("opens on the queue, not on the history", async ({ page }) => {
  // Its own row, for the same reason the resolve test makes one: an empty queue is a legitimate
  // state of this instance and would otherwise read as a broken screen (PF-006).
  const { submissionId } = await mintSubmissionFailure();
  try {
    await signIn(page, SUPERADMIN, "/en/submission-failures");

    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", { name: "Submission failures", level: 1 }),
    ).toBeVisible();
    await expect(main.getByRole("link", { name: "Unresolved" })).toHaveAttribute(
      "aria-current",
      "true",
    );

    // Every failure here is the same infrastructure error, which is what makes the kind worth
    // naming in words rather than by an icon: this is the machine's fault, not a student's.
    await expect(main.getByText("Evaluation failed").first()).toBeVisible();
    await expect(main.getByRole("link", { name: "The solution" }).first()).toBeVisible();

    // Both scopes are core-api's own lists, and the history is the larger of the two.
    const unresolved = Number(
      (await main.getByText(/^\d+ failures?\.$/).innerText()).split(" ")[0],
    );
    await main.getByRole("link", { name: "Everything" }).click();
    await expect(page).toHaveURL(/[?&]scope=all$/);
    const all = Number((await main.getByText(/^\d+ failures?\.$/).innerText()).split(" ")[0]);
    expect(all).toBeGreaterThanOrEqual(unresolved);
  } finally {
    await deleteSubmissionIfPresent(submissionId);
  }
});

test("a reference solution's failure links to the screen that shows it", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/submission-failures?scope=all");
  const main = page.getByRole("main");

  // core-api names the job's kind in the description, which is the only thing telling these rows
  // apart from the student submissions filling the same list -- and every one of them is resolved,
  // so the history is where they are.
  await main.getByPlaceholder("Filter by description or kind").fill("type: 'reference'");

  // Addressed by both ids, because that is how T-011's route is addressed (G-029).
  const link = main.getByRole("link", { name: "A reference solution" }).first();
  await expect(link).toHaveAttribute(
    "href",
    /\/en\/exercises\/[0-9a-f-]+\/reference-solutions\/[0-9a-f-]+$/,
  );

  await link.click();
  await expect(page).toHaveURL(/\/en\/exercises\/[0-9a-f-]+\/reference-solutions\/[0-9a-f-]+$/);
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
});

test("resolving one takes it out of the queue for good", async ({ page }) => {
  // This suite's own failure, made and removed here, so resolving it permanently costs the shared
  // queue nothing (PF-006).
  const { submissionId, jobId: job } = await mintSubmissionFailure();
  try {
    await signIn(page, SUPERADMIN, "/en/submission-failures");
    const main = page.getByRole("main");

    // Found by its own job id rather than by position: every failure on this machine reads alike
    // and differs only there, and a positional pick is a test of whatever ran last.
    await main.getByPlaceholder("Filter by description or kind").fill(job);
    const row = main.getByRole("row").filter({ hasText: job });
    await expect(row).toHaveCount(1);

    await row.getByRole("button", { name: "Resolve" }).click();
    await page.getByLabel("What was done about it").fill("[e2e] resolved by the smoke suite");
    await page.getByRole("dialog").getByRole("button", { name: "Resolve" }).click();
    await expect(
      page.getByText("The failure was marked as resolved.", { exact: true }),
    ).toBeVisible();

    // Gone from the queue -- asserted as the row's absence, not through the filter box: resolving
    // the last open failure empties the queue, and an empty queue renders the empty state instead
    // of the table, so there is no filter to type into. (Found the hard way: `fill` timed out.)
    await expect(main.getByRole("row").filter({ hasText: job })).toHaveCount(0);

    // ...and in the history, with what was said about it.
    await main.getByRole("link", { name: "Everything" }).click();
    await expect(page).toHaveURL(/[?&]scope=all$/);
    await main.getByPlaceholder("Filter by description or kind").fill(job);
    const resolved = main.getByRole("row").filter({ hasText: job });
    await expect(resolved).toHaveCount(1);
    await expect(resolved).toContainText("Resolved");
    await expect(resolved).toContainText("[e2e] resolved by the smoke suite");
  } finally {
    // Takes the failure with it, so the instance is left as it was found.
    await deleteSubmissionIfPresent(submissionId);
  }
});

test("is refused to anyone core-api does not trust with it", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/submission-failures");
  // A supervisor administers groups and sees none of this: the failure ACL is the instance's, not
  // a group's. core-api answers 403 and the page is the refusal, not an error.
  await expect(page.getByRole("main")).toContainText("Forbidden");
});
