import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { CLASSMATE, SUPERADMIN } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import {
  restoreSeededReviewRequest,
  seededSolutionWithOpenReview,
  seededSolutionWithoutReview,
  setReviewRequestedDirectly,
} from "./helpers/core-api";

/**
 * A student asking a teacher to look at a solution (G-003).
 *
 * **The point of this ticket is the second test.** S-002 built the teacher's "reviews students have
 * asked for" queue on the dashboard, and until now nothing in this app could put a solution into
 * it -- `reviewRequested` was read in four places and written in none, so that panel was empty by
 * construction. Asserting the control works is not enough; what matters is that the queue fills.
 *
 * Both tests clear the flag in a `finally`, because it is a seeded solution and a request left
 * standing would show up on the teacher's dashboard in every later run.
 *
 * **Serial, and that is not caution.** There is exactly one seeded solution without a review, so
 * every test here acts on the *same* one -- and run in parallel, the first test's teardown clears
 * the flag the second has just set, so the second looks for its solution in the queue and core-api
 * has already been told to take it out. Confirmed rather than assumed: asking core-api's
 * `/review-requests` directly, with the flag set, returns the solution.
 */
test.describe.configure({ mode: "serial" });

async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

test("a student asks for a review on their own solution, and takes it back", async ({ page }) => {
  const { id } = await seededSolutionWithoutReview(CLASSMATE);
  try {
    await signIn(page, CLASSMATE, `/en/solutions/${id}`);
    const main = page.getByRole("main");

    await main.getByRole("button", { name: "Ask for a review" }).click();
    await expect(main.getByRole("button", { name: "Withdraw the request" })).toBeVisible();
    await expect(page.getByText("Review requested")).toBeVisible();

    await main.getByRole("button", { name: "Withdraw the request" }).click();
    await expect(main.getByRole("button", { name: "Ask for a review" })).toBeVisible();
  } finally {
    await setReviewRequestedDirectly(id, false);
    // `reviewRequest` is unique per author and assignment -- core-api clears it everywhere else
    // when it is set -- so clearing this one is not the same as restoring what setting it
    // displaced. This writes on the classmate for that reason, and re-asserts the seed's own
    // request either way.
    await restoreSeededReviewRequest();
  }
});

test("the request reaches the teacher's dashboard queue", async ({ page }) => {
  const { id } = await seededSolutionWithoutReview(CLASSMATE);
  try {
    await signIn(page, CLASSMATE, `/en/solutions/${id}`);
    await page.getByRole("main").getByRole("button", { name: "Ask for a review" }).click();
    await expect(
      page.getByRole("main").getByRole("button", { name: "Withdraw the request" }),
    ).toBeVisible();

    // The whole reason this ticket ranked where it did. Asserted as *this* solution appearing in
    // the panel rather than as the panel existing: the seed already leaves two requests standing,
    // so the heading is there either way and would prove nothing.
    await signIn(page, SUPERADMIN, "/en/dashboard");
    const queue = page
      .getByRole("main")
      .locator('section[aria-labelledby="dashboard-review-requests"]');
    await expect(
      queue.getByRole("heading", { name: "Reviews students have asked for" }),
    ).toBeVisible();
    await expect(queue.locator(`a[href$="/solutions/${id}"]`)).toHaveCount(1);
  } finally {
    await setReviewRequestedDirectly(id, false);
    // Clearing this one's flag is not the same as restoring the state it displaced: the flag is
    // unique per author and assignment, so setting it here withdrew the seed's own request from
    // Alice's other attempt.
    await restoreSeededReviewRequest();
  }
});

test("is not offered once a review exists", async ({ page }) => {
  // The seed opens a review on its first solution, which is exactly the state this guard is about:
  // asking for something already happening is noise, and withdrawing would not stop a teacher who
  // has started reading -- core-api keeps the flag and the review independently.
  const { id } = await seededSolutionWithOpenReview();
  await signIn(page, SUPERADMIN, `/en/solutions/${id}`);
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { name: "Summary" })).toBeVisible();
  // The teacher's wording, not the student's: this reader holds `setFlag`, and the control marks
  // rather than asks for them.
  await expect(main.getByRole("button", { name: "Flag for review" })).toHaveCount(0);

  // ...while a solution without one still offers it, to the same reader on the same screen.
  const clean = await seededSolutionWithoutReview(CLASSMATE);
  await page.goto(`/en/solutions/${clean.id}`);
  await expect(main.getByRole("button", { name: "Flag for review" })).toBeVisible();
});
