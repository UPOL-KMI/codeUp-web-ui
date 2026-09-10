import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERVISOR } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import { cleanUpCreatedExercises } from "./helpers/created-exercises";

/** PF-007: every exercise these tests create, removed even when a test dies first. */
const trackExercise = cleanUpCreatedExercises();

/**
 * The exercise configuration editor (T-009).
 *
 * The happy path **creates a real exercise and deletes it again**, the shape T-001 and T-008 both
 * take: the whole point is that a brand-new exercise starts broken and that this screen is what
 * fixes it, which cannot be checked against a seeded fixture without changing it. The seeded
 * exercise is only *read* here -- saving would rewrite its configuration into the normalised
 * shape, and the catalog's and detail's own specs count on what it is now.
 *
 * The three saves are checked in the order they depend on each other, because that dependency is
 * the screen's design: no tests means nothing to configure, no language means the same, and both
 * saves rewrite the configuration underneath the third.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

const SEEDED_EXERCISE = "[seed] Echo Greeting";

test("reads a configured exercise without changing it", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/exercises?q=Echo");
  const main = page.getByRole("main");

  await main.getByRole("link", { name: SEEDED_EXERCISE }).click();
  await expect(main.getByRole("heading", { name: SEEDED_EXERCISE, level: 1 })).toBeVisible();
  await main.getByRole("link", { name: "Tests and evaluation" }).click();

  await expect(main.getByRole("heading", { name: "Tests and evaluation", level: 1 })).toBeVisible();

  // The test, the language and the per-test values all come off the live configuration.
  await expect(main.getByRole("textbox", { name: "Name" })).toHaveValue("Test 1");
  await expect(main.getByRole("checkbox", { name: /Python 3/ })).toBeChecked();
  await expect(main.getByRole("combobox", { name: "Expected output" })).toHaveValue("expected.txt");
  await expect(main.getByRole("combobox", { name: "Comparison" })).toHaveValue(
    "recodex-judge-normal",
  );
  await expect(main.getByRole("textbox", { name: "Exit codes that count as success" })).toHaveValue(
    "0",
  );

  // Which per-environment fields exist is read off the instance's own pipelines: Python declares
  // an entry point, so it is offered; it takes no jar files or compiler arguments, so those are
  // not. Nothing here asserts a field that core-api has no variable for.
  await expect(main.getByRole("combobox", { name: "Entry point" })).toBeVisible();
  await expect(main.getByText("Libraries", { exact: true })).toHaveCount(0);
  await expect(main.getByText("Compiler arguments", { exact: true })).toHaveCount(0);
});

test("takes a new exercise from broken to configured, and removes it again", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/exercises");
  const main = page.getByRole("main");

  await main.getByLabel("New exercise in").selectOption({ label: "[seed] Intro to Programming" });
  await main.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/en\/exercises\/[0-9a-f-]+\/edit$/);
  trackExercise(page.url());
  const editUrl = page.url();
  const configUrl = editUrl.replace(/\/edit$/, "/edit-config");

  await page.goto(configUrl);
  await expect(main.getByRole("heading", { name: "Tests and evaluation", level: 1 })).toBeVisible();

  // Nothing to configure yet, and the screen says which of the two reasons apply rather than
  // rendering a form whose every select is empty.
  await expect(main.getByText("There is nothing to configure yet:")).toBeVisible();
  await expect(main.getByText("the exercise has no tests", { exact: true })).toBeVisible();
  await expect(main.getByText("no language is selected", { exact: true })).toBeVisible();

  // A test, named by the form and saved. core-api mints the id.
  await main.getByRole("button", { name: "Add a test" }).click();
  await main.getByRole("textbox", { name: "Name" }).fill("Small input");
  await main.getByRole("button", { name: "Save tests" }).click();
  await expect(page.getByText("Tests saved.", { exact: true })).toBeVisible();

  // A language. Adding one rewrites the configuration, which is why the page reloads after.
  await main.getByRole("checkbox", { name: /Python 3/ }).check();
  await main.getByRole("button", { name: "Save languages" }).click();
  await expect(page.getByText("Languages saved.", { exact: true })).toBeVisible();

  // Now the per-test form is there, with the fields Python's pipelines declare.
  await expect(main.getByRole("button", { name: "Save configuration" })).toBeVisible();
  await expect(main.getByText("Small input")).toBeVisible();
  await expect(main.getByRole("combobox", { name: "Entry point" })).toBeVisible();

  // Values that are not files can be set even on an exercise with nothing attached, which this
  // one has -- so the round trip is checked with those.
  await main.getByRole("textbox", { name: "Exit codes that count as success" }).fill("0, 2-4");
  await main.getByRole("button", { name: "Add", exact: true }).nth(1).click();
  await main.getByRole("textbox", { name: "Arguments 1" }).fill("--verbose");
  await main.getByRole("button", { name: "Save configuration" }).click();
  await expect(page.getByText("Configuration saved.", { exact: true })).toBeVisible();

  // Read it back from core-api through a fresh page load, not from the form's own state.
  await page.reload();
  await expect(main.getByRole("textbox", { name: "Exit codes that count as success" })).toHaveValue(
    "0, 2-4",
  );
  await expect(main.getByRole("textbox", { name: "Arguments 1" })).toHaveValue("--verbose");

  // Renaming a test is the case core-api implements as copy-on-write: the test gets a new id and
  // core-api carries the configuration over to it. The exit codes must survive that.
  await main.getByRole("textbox", { name: "Name" }).fill("Large input");
  await main.getByRole("button", { name: "Save tests" }).click();
  await expect(page.getByText("Tests saved.", { exact: true })).toBeVisible();
  await expect(main.getByText("Large input")).toBeVisible();
  await expect(main.getByRole("textbox", { name: "Exit codes that count as success" })).toHaveValue(
    "0, 2-4",
  );

  // Two tests cannot share a name; the form says so rather than letting core-api refuse the save.
  await main.getByRole("button", { name: "Add a test" }).click();
  await main.getByRole("textbox", { name: "Name" }).nth(1).fill("Large input");
  await main.getByRole("button", { name: "Save tests" }).click();
  await expect(main.getByText("Two tests cannot have the same name.")).toBeVisible();

  // The exercise is no longer broken for want of tests or languages -- only for the pieces this
  // screen does not own.
  await page.reload();
  await expect(main.getByText("It has no tests.")).toHaveCount(0);
  await expect(main.getByText("No language has been selected for it.")).toHaveCount(0);

  // Put it back, through the product.
  await page.goto(editUrl);
  await main.getByRole("button", { name: "Delete this exercise" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: "Delete this exercise" }).click();
  await expect(page.getByText("The exercise was deleted.", { exact: true })).toBeVisible();
});

test("a language that cannot share an exercise is refused before saving", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/exercises");
  const main = page.getByRole("main");

  await main.getByLabel("New exercise in").selectOption({ label: "[seed] Intro to Programming" });
  await main.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/en\/exercises\/[0-9a-f-]+\/edit$/);
  trackExercise(page.url());
  const editUrl = page.url();
  await page.goto(editUrl.replace(/\/edit$/, "/edit-config"));

  // This deployment has no exclusive environment installed, so the rule is checked the only way
  // it can be here: two ordinary languages save, which is what the check must not block.
  // **Both have to be languages this deployment actually installs.** It asked for Java, which is
  // not one of the four here (`bash`, `c-gcc-linux`, `cxx-gcc-linux`, `python3`), so the checkbox
  // it waited for could never appear and the test failed on the fixture rather than on the rule.
  await main.getByRole("checkbox", { name: /Python 3/ }).check();
  await main.getByRole("checkbox", { name: /Bash/ }).check();
  await main.getByRole("button", { name: "Save languages" }).click();
  await expect(page.getByText("Languages saved.", { exact: true })).toBeVisible();

  await page.goto(editUrl);
  await main.getByRole("button", { name: "Delete this exercise" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete this exercise" }).click();
  await expect(page.getByText("The exercise was deleted.", { exact: true })).toBeVisible();
});

test("is refused to a student", async ({ page }) => {
  await signIn(page, STUDENT, "/en/exercises");
  await expect(page.getByRole("main")).toContainText("Forbidden");
});
