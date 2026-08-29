import { test, expect } from "@playwright/test";

import { STUDENT, SUPERADMIN } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

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

  // The flagged solution is one of the ones in the teacher's own review queue -- but *which* one
  // is not fixed: this instance carries solutions from earlier seed runs that pointed at a
  // different assignment (the seed's assignment ordering is only stable as of S-019), and all
  // three seeded assignments share a name. So the queue is walked until the badge appears, which
  // is also the honest statement of what is being tested: the badge is how a teacher finds this.
  await page.goto("/en/dashboard");
  const main = page.getByRole("main");
  const queue = page.getByRole("region", { name: "Reviews students have asked for" });
  const rows = queue.locator("tbody tr").getByRole("link", { name: "Alice Student" });

  // `count()` does not auto-wait, so the queue has to be on screen before it is counted.
  await expect(queue.locator("tbody tr").first()).toBeVisible();
  const rowCount = await rows.count();
  expect(rowCount).toBeGreaterThan(0);
  let flagged = false;
  for (let index = 0; index < rowCount; index++) {
    await rows.nth(index).click();
    await expect(page).toHaveURL(/\/en\/solutions\/[0-9a-f-]+$/);
    // The solution has to be on screen before the badge is counted -- `count()` does not wait.
    await expect(main.getByRole("heading", { name: "Summary" })).toBeVisible();
    if ((await main.getByRole("link", { name: "Similarities" }).count()) > 0) {
      flagged = true;
      break;
    }
    await page.goBack();
  }
  expect(flagged).toBe(true);

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
