import { test, expect } from "@playwright/test";

import { STUDENT, SUPERADMIN } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import { seededFlaggedSolution } from "./helpers/core-api";

/**
 * The detected-similarities report (S-019).
 *
 * The fixture it reads is seeded (`ensureDetectedSimilarity`): ReCodEx detects nothing itself, so
 * the only way this screen ever has data is for a tool to have uploaded some, and the seed does
 * exactly that -- one similarity between the two seeded students' solutions to the same
 * assignment.
 */
test("leads a teacher from a flagged solution to what was matched", async ({ page }) => {
  const cookie = await loginAndGetCookie(SUPERADMIN);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);

  // **Starts at the flagged solution, not at the teacher's dashboard.** It used to walk the review
  // queue and take the first row that offered the badge, which coupled this to a fixture it does
  // not own -- a `reviewRequest` is unique per author and assignment, so any spec that writes one
  // moves the seed's row out of that queue for as long as it holds it, and the first row offering
  // a badge could anyway be a solution an earlier run flagged against an account since deleted.
  // Whether the queue leads here is `dashboard.spec.ts`'s subject; this one is the report (PF-013).
  const { id } = await seededFlaggedSolution();
  await page.goto(`/en/solutions/${id}`);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Summary" })).toBeVisible();

  await main.getByRole("link", { name: "Similarities" }).click();
  await expect(page).toHaveURL(/\/en\/solutions\/[0-9a-f-]+\/plagiarisms$/);

  // The report says who reported it, who it matched, and shows both sides.
  await expect(main.getByText("ReCodEx does not detect similarities itself")).toBeVisible();
  await expect(main.getByText(/Bob Classmate — \d+ % similar/)).toBeVisible();
  await expect(main.getByRole("heading", { name: /^This solution —/ })).toBeVisible();
  await expect(main.getByRole("heading", { name: /^The other solution —/ })).toBeVisible();
  await expect(main.locator("mark").first()).toBeVisible();
});

test("keeps the report away from the author of the solution", async ({ page }) => {
  const cookie = await loginAndGetCookie(STUDENT);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto("/en/dashboard");
  await page.getByRole("main").locator("tbody tr").first().getByRole("link").first().click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+$/);

  const main = page.getByRole("main");
  // The student's own attempts carry no similarities badge: core-api does not disclose the batch
  // to the solution's author at all, so there is nothing for the UI to hide.
  await expect(main.getByRole("link", { name: "Similarities" })).toHaveCount(0);

  await main
    .getByRole("link", { name: /^Attempt/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/en\/solutions\/[0-9a-f-]+$/);
  await expect(main.getByRole("link", { name: "Similarities" })).toHaveCount(0);

  await page.goto(`${page.url()}/plagiarisms`);
  await expect(main.getByText("You don't have permission to access this resource.")).toBeVisible();
});
