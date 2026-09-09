import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERADMIN, SUPERVISOR } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * An exercise's reference solutions (T-011).
 *
 * The seeded exercise is read; everything that writes happens to a solution this spec submits and
 * deletes again. **This machine cannot produce a real pass or fail** (DEC-031), so every reference
 * solution here reports an infrastructure failure -- which is what the assertions expect, and is
 * the honest state of this deployment rather than a stubbed one.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

// The seeded reference solutions are the superadmin's own and are private, and core-api filters
// this list one solution at a time -- so they are readable by their author and by nobody else.
test("lists an exercise's reference solutions and opens one", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/exercises?q=Echo");
  const main = page.getByRole("main");

  await main.getByRole("link", { name: "[seed] Echo Greeting" }).click();
  await main.getByRole("link", { name: "Reference solutions" }).click();
  await expect(main.getByRole("heading", { name: "Reference solutions", level: 1 })).toBeVisible();

  const row = main.getByRole("row").filter({ hasText: "[seed] reference solution" }).first();
  await expect(row).toBeVisible();
  await expect(row.getByText("Python")).toBeVisible();

  // Visibility is a scale, not a switch, and it is a real control for whoever may set it.
  await expect(row.getByRole("combobox")).toHaveValue("0");

  await row.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/reference-solutions\/[0-9a-f-]+$/);
  await expect(main.getByRole("heading", { level: 1 })).toContainText("[seed] reference solution");

  // The submitted file, read rather than merely named (G-013): until that ticket this screen
  // listed a name and a size, so the author of an exercise could not read the solution that
  // proves it works. Rendered through S-017's own viewer, so it is highlighted server-side.
  await expect(main.getByText("solution.py")).toBeVisible();
  await expect(main.locator("figure").filter({ hasText: "solution.py" })).toContainText(
    'print("Hello, ReCodEx!")',
  );
  await expect(main.getByRole("link", { name: "Download archive" })).toHaveAttribute(
    "href",
    /^\/api\/reference-solutions\/[0-9a-f-]+\/download$/,
  );
  await expect(main.getByRole("heading", { name: "What the pipeline did" })).toBeVisible();
  // This machine cannot evaluate, so the honest state is an infrastructure failure -- and the
  // screen must say it is not the reader's fault rather than dressing it up as a test result.
  await expect(main.getByText("Isolate init error", { exact: false })).toBeVisible();
});

test("keeps every run of a reference solution, and reads or removes one", async ({ page }) => {
  // Writes on the instance and cleans up after itself: it evaluates the seeded solution a second
  // time, because a history of one is no history and the seed makes exactly one run.
  await signIn(page, SUPERADMIN, "/en/exercises?q=Echo");
  const main = page.getByRole("main");

  await main.getByRole("link", { name: "[seed] Echo Greeting" }).click();
  await main.getByRole("link", { name: "Reference solutions" }).click();
  const row = main.getByRole("row").filter({ hasText: "[seed] reference solution" }).first();
  await row.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/reference-solutions\/[0-9a-f-]+$/);

  // One run, so there is nothing to choose between and core-api would refuse to delete it.
  await expect(main.getByRole("heading", { name: "Earlier evaluations" })).toBeHidden();
  await expect(main.getByRole("link", { name: "Download the result archive" })).toBeVisible();

  // Debug is its own button, not a checkbox -- G-002's shape on the other kind of solution.
  await main.getByRole("button", { name: "Evaluate again (debug)", exact: true }).click();
  await expect(main.getByRole("heading", { name: "Earlier evaluations" })).toBeVisible();
  const runs = main.getByRole("listitem").filter({ has: page.locator("time") });
  await expect(runs).toHaveCount(2);
  await expect(runs.first()).toContainText("Debug");

  // The older run is a URL of its own, and the page says it is not the one that counts now.
  await runs.last().getByRole("link").first().click();
  await expect(page).toHaveURL(/[?&]submission=[0-9a-f-]+$/);
  await expect(main.getByText("This is not the last evaluation")).toBeVisible();

  // Deleting the run being shown has to leave the page on one that still exists.
  await runs.first().getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete evaluation" }).click();

  // Back to one run, so the history and its delete controls are gone again -- which is the rule
  // core-api enforces (`checkDeleteSubmission` refuses the last one) rendered as an absence.
  await expect(main.getByRole("heading", { name: "Earlier evaluations" })).toBeHidden();
});

test("submits a reference solution, and refuses files no language of the exercise matches", async ({
  page,
}) => {
  await signIn(page, SUPERVISOR, "/en/exercises?q=Echo");
  const main = page.getByRole("main");

  await main.getByRole("link", { name: "[seed] Echo Greeting" }).click();
  await main.getByRole("link", { name: "Reference solutions" }).click();
  await expect(main.getByRole("heading", { name: "Reference solutions", level: 1 })).toBeVisible();

  // A colleague's private answers are not this reader's, and the screen says which kind of empty
  // this is rather than claiming the exercise has none -- it plainly does, it is assignable.
  await expect(
    main.getByText("This exercise does have reference solutions", { exact: false }),
  ).toBeVisible();

  // core-api decides the language from the file names, so a file no configured language claims is
  // reported before anything is submitted rather than refused afterwards.
  await page.setInputFiles('input[type="file"]', {
    name: "solution.hs",
    mimeType: "text/plain",
    buffer: Buffer.from('main = putStrLn "Hello, ReCodEx!"\n'),
  });
  const check = main.getByRole("button", { name: "Check the files" });
  await expect(check).toBeEnabled({ timeout: 30_000 });
  await check.click();
  await expect(
    main.getByText("None of this exercise's languages matches the files you uploaded.", {
      exact: false,
    }),
  ).toBeVisible();

  // Take the wrong file back out first -- pre-submit sees the whole set, so leaving it there
  // would keep the answer "no language matches", which is correct and not what is being tested.
  await main.getByRole("button", { name: "Remove", exact: true }).first().click();

  // The real one.
  await page.setInputFiles('input[type="file"]', {
    name: "solution.py",
    mimeType: "text/x-python",
    buffer: Buffer.from('print("Hello, ReCodEx!")\n'),
  });
  await main.getByLabel("Description").fill("[e2e] a second answer");
  const check2 = main.getByRole("button", { name: "Check the files" });
  await expect(check2).toBeEnabled({ timeout: 30_000 });
  await check2.click();
  await expect(main.getByLabel("Language", { exact: true })).toHaveValue("python3");
  await main.getByRole("button", { name: "Submit it" }).click();
  await expect(
    page.getByText("Submitted. It is being evaluated now.", { exact: true }),
  ).toBeVisible();

  const row = main.getByRole("row").filter({ hasText: "[e2e] a second answer" });
  await expect(row).toBeVisible();

  // Put it back, through the product. It is the only one *this reader* can see, so the
  // confirmation is the one that warns about making the exercise unassignable -- which is what
  // this screen knows: it counts what it can see, and core-api decides the rest.
  await row.getByRole("button", { name: "Delete" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("makes the exercise impossible to assign");
  await dialog.getByRole("button", { name: "Delete it" }).click();
  await expect(page.getByText("The solution was deleted.", { exact: true })).toBeVisible();
  await expect(
    main.getByText("This exercise does have reference solutions", { exact: false }),
  ).toBeVisible();
});

test("a student may not read an exercise's answers", async ({ page }) => {
  await signIn(page, STUDENT, "/en/exercises");
  await expect(page.getByRole("main")).toContainText("Forbidden");
});
