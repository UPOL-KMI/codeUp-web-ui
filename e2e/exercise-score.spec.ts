import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { SUPERVISOR } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import { cleanUpCreatedExercises } from "./helpers/created-exercises";

/** PF-007: every exercise these tests create, removed even when a test dies first. */
const trackExercise = cleanUpCreatedExercises();

/**
 * The custom score expression (T-025).
 *
 * Everything happens to an exercise this spec creates and deletes again: a score is how an
 * exercise is graded, and the seeded one's is what several other specs read.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

async function exerciseWithTests(page: Page): Promise<string> {
  const main = page.getByRole("main");
  await main.getByLabel("New exercise in").selectOption({ label: "[seed] Intro to Programming" });
  await main.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/en\/exercises\/[0-9a-f-]+\/edit$/);
  trackExercise(page.url());
  const editUrl = page.url();

  // The tests and the score they add up to are one tab (T-033).
  await page.goto(`${editUrl.replace(/\/edit$/, "/edit-config")}?tab=tests`);
  await main.getByRole("button", { name: "Add a test" }).click();
  await main.getByRole("textbox", { name: "Name" }).fill("Small input");
  await main.getByRole("button", { name: "Add a test" }).click();
  await main.getByRole("textbox", { name: "Name" }).nth(1).fill("Large input");
  await main.getByRole("button", { name: "Save tests" }).click();
  await expect(page.getByText("Tests saved.", { exact: true })).toBeVisible();
  // Saving tests mints their ids, which re-keys the form and re-seeds it from core-api. That
  // refresh lands asynchronously, so anything typed straight afterwards would be wiped by it --
  // reload to be on the other side of it deterministically.
  await page.reload();
  return editUrl;
}

test("writes a score of its own, and comes back from it", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/exercises");
  const main = page.getByRole("main");
  const editUrl = await exerciseWithTests(page);

  // Switching in is seeded from what the exercise already does, so it grades the same.
  await main.getByRole("button", { name: "Write the score myself" }).click();
  await expect(
    page.getByText("This exercise now has a score of its own.", { exact: true }),
  ).toBeVisible();

  const expression = main.getByLabel("Expression");
  // Seeded in the tests' own order, which is by name.
  await expect(expression).toHaveValue('avg("Large input", "Small input")');
  await expect(main.getByText("This expression is an average")).toBeVisible();

  // A misspelt test name is not a syntax error -- it is an exercise graded on nothing.
  await expression.fill('avg("Small input", "Larg input")');
  await expect(main.getByText("No such test: Larg input", { exact: false })).toBeVisible();
  await expect(main.getByRole("button", { name: "Save the expression" })).toBeDisabled();

  // Nor is a broken expression, and the parser says where.
  await expression.fill('avg("Small input",');
  await expect(main.getByText("The expression stops in the middle of something")).toBeVisible();
  await expect(main.getByRole("button", { name: "Save the expression" })).toBeDisabled();

  // Something only an expression can say: the second test only counts if the first passed.
  await expression.fill('"Small input" * "Large input"');
  await expect(main.getByRole("button", { name: "Save the expression" })).toBeEnabled();
  await main.getByRole("button", { name: "Save the expression" }).click();
  await expect(page.getByText("The expression was saved.", { exact: true })).toBeVisible();

  // Read it back from core-api: the tree is stored, the text is this app's notation.
  await page.reload();
  await expect(main.getByLabel("Expression")).toHaveValue('"Small input" * "Large input"');
  await expect(main.getByText("This expression is an average")).toHaveCount(0);

  // Going back is not lossless here, and the dialog says so rather than warning in the abstract.
  await main.getByRole("button", { name: "Go back to an average" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("cannot be turned into weights");
  await dialog.getByRole("button", { name: "Use an average" }).click();
  await expect(page.getByText("The score is an average again.", { exact: true })).toBeVisible();

  // Back to the ordinary form, with the two tests still there.
  await expect(main.getByRole("radio", { name: "Every test counts the same" })).toBeChecked();
  // The tests form sorts by name, so "Large input" comes first -- what matters is that both
  // survived the trip out to an expression and back.
  await expect(main.getByRole("textbox", { name: "Name" })).toHaveCount(2);

  await page.goto(editUrl);
  await main.getByRole("button", { name: "Delete this exercise" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete this exercise" }).click();
  await expect(page.getByText("The exercise was deleted.", { exact: true })).toBeVisible();
});

test("an expression that is an average converts back to the weights it means", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/exercises");
  const main = page.getByRole("main");
  const editUrl = await exerciseWithTests(page);

  // Give the tests different weights first, so switching in produces the weighted shape.
  await main.getByRole("radio", { name: "Tests carry different weights" }).check();
  // Sorted by name, so row 0 is "Large input" and row 1 is "Small input".
  const weight = main.getByRole("spinbutton", { name: "Weight" }).first();
  await weight.fill("50");
  await expect(weight).toHaveValue("50");
  await main.getByRole("button", { name: "Save tests" }).click();
  await expect(page.getByText("Tests saved.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(main.getByRole("spinbutton", { name: "Weight" }).first()).toHaveValue("50");

  await main.getByRole("button", { name: "Write the score myself" }).click();
  await expect(
    page.getByText("This exercise now has a score of its own.", { exact: true }),
  ).toBeVisible();
  await expect(main.getByLabel("Expression")).toHaveValue(
    '(50 * "Large input" + 100 * "Small input") / 150',
  );

  // And back again: the weights it means are named, and nothing is lost.
  await main.getByRole("button", { name: "Go back to an average" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Large input → 50");
  await expect(dialog).toContainText("Small input → 100");
  await dialog.getByRole("button", { name: "Use an average" }).click();
  await expect(page.getByText("The score is an average again.", { exact: true })).toBeVisible();

  await page.reload();
  await expect(main.getByRole("radio", { name: "Tests carry different weights" })).toBeChecked();
  await expect(main.getByRole("spinbutton", { name: "Weight" }).first()).toHaveValue("50");

  await page.goto(editUrl);
  await main.getByRole("button", { name: "Delete this exercise" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete this exercise" }).click();
  await expect(page.getByText("The exercise was deleted.", { exact: true })).toBeVisible();
});
