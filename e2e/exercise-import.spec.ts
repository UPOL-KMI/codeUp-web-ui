import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERVISOR } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import { exerciseConfigVariables } from "./helpers/core-api";
import { cleanUpCreatedExercises } from "./helpers/created-exercises";

/**
 * Importing a GitHub Classroom assignment (X-001).
 *
 * **The report is the subject, not the exercise.** What makes an importer trustworthy is that it
 * says what it could not carry over, so the two tests that matter here are the one where a file
 * maps cleanly and the one where half of it does not -- and the second asserts the *reasons*, in
 * the words a reader sees, rather than a count.
 *
 * The exercise a successful import creates is real, and removed by the file's `afterEach`
 * (PF-011/PF-014's pattern) rather than only at the end of the test that made it.
 */
const trackExercise = cleanUpCreatedExercises();

const CLEAN = JSON.stringify({
  tests: [
    {
      name: "Adds two numbers",
      setup: "",
      run: "python3 main.py",
      input: "2 3\n",
      output: "5\n",
      comparison: "exact",
      timeout: 0.5,
      points: 3,
    },
    {
      name: "Adds two negatives",
      setup: "",
      run: "python3 main.py",
      input: "-2 -3\n",
      output: "-5\n",
      comparison: "exact",
      timeout: 0.5,
      points: 2,
    },
  ],
});

const MESSY = JSON.stringify({
  tests: [
    { name: "Exact", run: "python3 main.py", input: "1", output: "1", comparison: "exact" },
    { name: "Loose", run: "python3 main.py", input: "1", output: "1", comparison: "included" },
    { name: "Pattern", run: "python3 main.py", input: "1", output: "^1$", comparison: "regex" },
    { name: "Suite", run: "pytest -q", input: "", output: "" },
    { name: "Nothing", run: "python3 main.py", input: "", output: "" },
    {
      name: "Needs pip",
      run: "python3 main.py",
      setup: "pip install -r requirements.txt",
      input: "1",
      output: "1",
      comparison: "exact",
    },
  ],
});

async function openImport(page: Page, account: SeedAccount): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto("/en/exercises/import");
}

test("reads a file that maps cleanly, and says every test maps", async ({ page }) => {
  await openImport(page, SUPERVISOR);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Import from GitHub Classroom" })).toBeVisible();

  await main.getByLabel("autograding.json").fill(CLEAN);
  await main.getByRole("button", { name: "Read the file" }).click();

  // Nothing is created by reading: the report comes first, on purpose.
  const report = main.getByRole("region", { name: "What this would import" });
  await expect(report.getByText("2 tests declared, 2 of which map.")).toBeVisible();
  await expect(report.getByText("Everything in the file maps.")).toBeVisible();
  // Scoped to the report: the pasted file is on the same screen, so an unscoped match finds the
  // textarea's own contents too.
  await expect(report.getByText("Adds two numbers", { exact: true })).toBeVisible();
  await expect(report.getByText("weight 3")).toBeVisible();
  // The language is guessed from `run` rather than asked for.
  await expect(main.getByLabel("Language")).toHaveValue("python3");
  await expect(main.getByText("Guessed from the run commands.")).toBeVisible();
  // And it says what an import cannot give the author, before they ask for one.
  await expect(main.getByText(/ReCodEx requires a reference solution/)).toBeVisible();
});

test("names what it could not carry over, test by test", async ({ page }) => {
  await openImport(page, SUPERVISOR);
  const main = page.getByRole("main");

  await main.getByLabel("autograding.json").fill(MESSY);
  await main.getByRole("button", { name: "Read the file" }).click();

  const report = main.getByRole("region", { name: "What this would import" });
  await expect(report.getByText("6 tests declared, 3 of which map.")).toBeVisible();
  await expect(report.getByText(/no judge here can do/)).toBeVisible();
  await expect(report.getByText(/hands the decision to a test framework/)).toBeVisible();
  await expect(report.getByText(/neither input nor expected output/)).toBeVisible();
  await expect(report.getByText(/compares token by token instead/)).toBeVisible();
  await expect(report.getByText(/setup command was dropped/)).toBeVisible();
  await expect(report.getByText("Not imported")).toHaveCount(3);
  await expect(report.getByText("Imported, with a difference")).toHaveCount(2);
});

test("refuses a file that is not an autograding.json", async ({ page }) => {
  await openImport(page, SUPERVISOR);
  const main = page.getByRole("main");

  await main.getByLabel("autograding.json").fill('{"name":"not one"}');
  await main.getByRole("button", { name: "Read the file" }).click();
  // `.first()`: a toast is announced in a live region as well as shown, so the sentence is on the
  // page twice by design.
  await expect(
    page
      .getByText("That is not an autograding.json: it has no tests array.", { exact: true })
      .first(),
  ).toBeVisible();
  await expect(main.getByRole("heading", { name: "What this would import" })).toHaveCount(0);
});

test("creates a draft exercise with the tests the file described", async ({ page }) => {
  await openImport(page, SUPERVISOR);
  const main = page.getByRole("main");

  await main.getByLabel("Create the exercise in").selectOption({
    label: "[seed] Intro to Programming",
  });
  await main.getByLabel("Exercise name").fill(`[e2e] Imported ${Date.now()}`);
  await main.getByLabel("autograding.json").fill(CLEAN);
  await main.getByRole("button", { name: "Read the file" }).click();
  await expect(
    main.getByRole("region", { name: "What this would import" }).getByText("2 of which map"),
  ).toBeVisible();

  await main.getByRole("button", { name: "Create the draft exercise" }).click();
  // It lands on the exercise's own settings, which is where the author finishes it.
  await expect(page).toHaveURL(/\/en\/exercises\/[0-9a-f-]+\/edit$/, { timeout: 60_000 });
  const exerciseId = trackExercise(page.url())!;

  // The tests really exist, under the names the file gave them. Read off the fields' *values*
  // rather than the page text, because that is where a test's name lives on this screen.
  await page.goto(page.url().replace(/\/edit$/, "/edit-config"));
  await expect(main.getByRole("heading", { name: "Tests", exact: true })).toBeVisible();
  const fieldValues = async () =>
    main
      .getByRole("textbox")
      .evaluateAll((fields) => fields.map((field) => (field as HTMLInputElement).value));
  await expect
    .poll(fieldValues)
    .toEqual(expect.arrayContaining(["Adds two numbers", "Adds two negatives"]));

  // **And the configuration, which is the half a unit test cannot reach.** The tests existing
  // proves the names were written; this proves each test knows which file is its input and which is
  // the output to compare against -- without that the exercise would have tests and grade nothing,
  // which is the failure X-001's write-up says an importer must not produce. Read from core-api
  // rather than the screen, which shows one test's configuration at a time.
  const variables = await exerciseConfigVariables(exerciseId);
  const valuesOf = (name: string) =>
    variables.filter((one) => one.name === name).map((one) => one.value);
  expect(valuesOf("stdin-file")).toEqual(
    expect.arrayContaining(["adds-two-numbers.in", "adds-two-negatives.in"]),
  );
  expect(valuesOf("expected-output")).toEqual(
    expect.arrayContaining(["adds-two-numbers.out", "adds-two-negatives.out"]),
  );
  expect(new Set(valuesOf("judge-type"))).toEqual(new Set(["diff"]));
});

test("is not a student's screen", async ({ page }) => {
  await openImport(page, STUDENT);
  // A student teaches no group, so there is nothing here for them to import into.
  await expect(page.getByRole("main")).toContainText("Choose the course");
});
