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
 * The advanced exercise configuration and the switch between the two kinds (T-024).
 *
 * Everything happens to an exercise this spec creates and deletes again. That matters more here
 * than elsewhere: switching an exercise to the advanced kind and back **rebuilds its
 * configuration**, so doing it to the seeded one would change what T-009's and T-011's specs read.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

test("takes an exercise to a configuration of its own and back again", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/exercises");
  const main = page.getByRole("main");

  await main.getByLabel("New exercise in").selectOption({ label: "[seed] Intro to Programming" });
  await main.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/en\/exercises\/[0-9a-f-]+\/edit$/);
  trackExercise(page.url());
  const editUrl = page.url();
  const configUrl = editUrl.replace(/\/edit$/, "/edit-config");

  // A test and a language first: the advanced editor asks core-api which variables the chosen
  // pipelines need, and it can only answer for a real environment.
  await page.goto(`${configUrl}?tab=tests`);
  await main.getByRole("button", { name: "Add a test" }).click();
  await main.getByRole("textbox", { name: "Name" }).fill("Test 1");
  await main.getByRole("button", { name: "Save tests" }).click();
  await expect(page.getByText("Tests saved.", { exact: true })).toBeVisible();
  await page.goto(`${configUrl}?tab=languages`);
  await main.getByRole("checkbox", { name: /Python 3/ }).check();
  await main.getByRole("button", { name: "Save languages" }).click();
  await expect(page.getByText("Languages saved.", { exact: true })).toBeVisible();

  // The way out of the standard form, which is what the advanced tab holds until an exercise
  // takes it. Going *to* the advanced kind loses nothing, so it does not confirm -- the
  // configuration in place is kept and the other editor reads it.
  await page.goto(`${configUrl}?tab=advanced`);
  await expect(main.getByRole("heading", { name: "A configuration of your own" })).toBeVisible();
  await main.getByRole("button", { name: "Configure it myself" }).click();
  await expect(
    page.getByText("This exercise now has a configuration of its own.", { exact: true }),
  ).toBeVisible();

  // The simple form is gone and the advanced editor is in its place.
  await expect(main.getByRole("heading", { name: "Pipelines", level: 3 })).toBeVisible();
  await expect(main.getByRole("button", { name: "Save configuration" })).toHaveCount(0);

  // Choosing pipelines is what decides which variables have to be filled in -- and UPolníček is the
  // one that says which those are.
  await main.getByRole("checkbox", { name: "Python execution & evaluation [stdout]" }).check();
  await main.getByRole("button", { name: "Save the pipelines" }).click();
  await expect(page.getByText("The pipelines were saved.", { exact: true })).toBeVisible();

  await expect(main.getByRole("heading", { name: "What each test supplies" })).toBeVisible();
  const judgeType = main.getByLabel("judge-type for Test 1");
  await expect(judgeType).toBeVisible();
  await judgeType.fill("recodex-judge-float");
  await main.getByRole("button", { name: "Save the values" }).click();
  await expect(page.getByText("The values were saved.", { exact: true })).toBeVisible();

  await page.reload();
  await expect(main.getByLabel("judge-type for Test 1")).toHaveValue("recodex-judge-float");

  // Coming back rebuilds, so it confirms -- and names what would actually be lost rather than
  // warning in the abstract.
  await main.getByRole("button", { name: "Use the standard form" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("heading", { name: "Rebuild this configuration?" })).toBeVisible();
  await expect(dialog).toContainText("every value the standard form does not know is dropped");
  await dialog.getByRole("button", { name: "Rebuild it" }).click();
  await expect(
    page.getByText("This exercise now uses the standard form.", { exact: true }),
  ).toBeVisible();

  // Back where it started: the standard form -- which lives under Tests again, the advanced tab
  // having gone back to holding the switch -- with the judge it was given carried across, because
  // `judge-type` is one of the variables that form does know.
  await page.goto(`${configUrl}?tab=tests`);
  await expect(main.getByRole("button", { name: "Save configuration" })).toBeVisible();
  await expect(main.getByRole("combobox", { name: "Comparison" })).toHaveValue(
    "recodex-judge-float",
  );

  await page.goto(editUrl);
  await main.getByRole("button", { name: "Delete this exercise" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete this exercise" }).click();
  await expect(page.getByText("The exercise was deleted.", { exact: true })).toBeVisible();
});

test("the standard form is not offered to an exercise that has its own configuration", async ({
  page,
}) => {
  await signIn(page, SUPERVISOR, "/en/exercises");
  const main = page.getByRole("main");

  await main.getByLabel("New exercise in").selectOption({ label: "[seed] Intro to Programming" });
  await main.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/en\/exercises\/[0-9a-f-]+\/edit$/);
  trackExercise(page.url());
  const editUrl = page.url();

  const configUrl = editUrl.replace(/\/edit$/, "/edit-config");
  await page.goto(`${configUrl}?tab=tests`);
  await main.getByRole("button", { name: "Add a test" }).click();
  await main.getByRole("textbox", { name: "Name" }).fill("Test 1");
  await main.getByRole("button", { name: "Save tests" }).click();
  await page.goto(`${configUrl}?tab=languages`);
  await main.getByRole("checkbox", { name: /Python 3/ }).check();
  await main.getByRole("button", { name: "Save languages" }).click();
  await expect(page.getByText("Languages saved.", { exact: true })).toBeVisible();
  await page.goto(`${configUrl}?tab=advanced`);
  await main.getByRole("button", { name: "Configure it myself" }).click();
  await expect(
    page.getByText("This exercise now has a configuration of its own.", { exact: true }),
  ).toBeVisible();

  // The language section says the choice moved rather than showing a form that would fight the
  // pipeline list, and the per-test simple form is gone entirely.
  await page.goto(`${configUrl}?tab=languages`);
  await expect(
    main.getByText("whose runtime environment is chosen together with its pipelines"),
  ).toBeVisible();
  await expect(main.getByRole("button", { name: "Save languages" })).toHaveCount(0);

  await page.goto(editUrl);
  await main.getByRole("button", { name: "Delete this exercise" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete this exercise" }).click();
  await expect(page.getByText("The exercise was deleted.", { exact: true })).toBeVisible();
});
