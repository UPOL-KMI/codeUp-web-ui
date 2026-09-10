import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERVISOR } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import { cleanUpCreatedExercises } from "./helpers/created-exercises";

/**
 * Creating an exercise and changing its settings (T-008).
 *
 * The happy path **creates a real exercise and deletes it again**, the same shape T-001's spec
 * takes and for the same reason: creating is the thing being tested, and an exercise left behind
 * would change what the catalog's own spec counts. Everything in between -- the settings save, a
 * tag, a second group, archiving -- happens to that exercise and goes with it.
 *
 * A new exercise is broken by construction (no tests), so nobody can assign it and no student can
 * meet it in the window it exists.
 *
 * **The deletion at the end of the test is the thing being tested; `cleanUpCreatedExercises` is
 * what makes it safe to test (PF-007).** Deleting only there meant any failure in between left the
 * exercise on the instance -- and four had accumulated that way, all named "Exercise by Sam
 * Supervisor" with no difficulty, which is exactly what a fixture looks like. PF-007 named this
 * file; **five more had the same defect** and share the same helper now.
 */

/** PF-007: every exercise these tests create, removed even when a test dies first. */
const trackExercise = cleanUpCreatedExercises();
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

test("creates an exercise, configures it, and removes it again", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/exercises");
  const main = page.getByRole("main");

  await main.getByLabel("New exercise in").selectOption({ label: "[seed] Intro to Programming" });
  await main.getByRole("button", { name: "Create" }).click();

  // core-api names it after its author and leaves it unconfigured, so the reader lands on the
  // settings form with the exercise already real -- there is no wizard to lose halfway.
  await expect(page).toHaveURL(/\/en\/exercises\/[0-9a-f-]+\/edit$/);
  await expect(main.getByRole("heading", { name: "Exercise settings", level: 1 })).toBeVisible();
  const editUrl = page.url();
  // Registered before anything that can fail: from here the exercise exists on the instance
  // whether or not the rest of this test runs.
  expect(trackExercise(editUrl)).not.toBeNull();

  // G-031b, and this is the only moment it can be checked: core-api creates an exercise with no
  // difficulty at all, and the save below gives it one. The catalog used to print the message key
  // `difficulty.` in that cell.
  await page.goto("/en/exercises?q=Exercise+by");
  await expect(main).not.toContainText("difficulty.");
  await expect(main.getByRole("cell", { name: "Not set", exact: true }).first()).toBeVisible();
  await page.goto(editUrl);

  // Every locale is edited at once; the one left blank is dropped rather than saved empty.
  await main.getByLabel("Name").first().fill("[e2e] Sorting Hat");
  await main.getByLabel("Text").first().fill("Sort the input **ascending**.");
  await main.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("The settings were saved.", { exact: true })).toBeVisible();

  // A tag is its own call, with nothing to save afterwards.
  await main.getByLabel("New tag").fill("e2e-tag");
  await main.getByRole("button", { name: "Add", exact: true }).first().click();
  await expect(page.getByText("The tag was added.", { exact: true })).toBeVisible();

  // A second group -- offered from the reader's own teaching groups, because core-api's rule is
  // written against the group as well as the exercise and publishes no hint for it.
  await main
    .getByLabel("Add to a group")
    .selectOption({ label: "[seed] Intro to Programming / Lab A" });
  await main.getByRole("button", { name: "Add", exact: true }).last().click();
  await expect(
    page.getByText("The exercise was added to the group.", { exact: true }),
  ).toBeVisible();
  // Scoped to the groups list: T-023 added a "Copy into" select that names every teaching group,
  // so the bare text now matches two options as well as the row this is about.
  await expect(
    main.getByRole("region", { name: "Groups" }).getByText("[seed] Intro to Programming / Lab A"),
  ).toBeVisible();

  // Archiving freezes it: the settings form is not rendered for an archived exercise at all.
  await main.getByRole("button", { name: "Archive this exercise" }).click();
  await expect(page.getByText("The exercise was archived.", { exact: true })).toBeVisible();
  await expect(main.getByRole("button", { name: "Save settings" })).toHaveCount(0);
  await main.getByRole("button", { name: "Restore this exercise" }).click();
  await expect(page.getByText("The exercise was restored.", { exact: true })).toBeVisible();
  await expect(main.getByRole("button", { name: "Save settings" })).toBeVisible();

  // What the detail screen makes of it, which is where the catalog leads.
  await main.getByRole("link", { name: "Back to the exercise" }).click();
  await expect(main.getByRole("heading", { name: "[e2e] Sorting Hat", level: 1 })).toBeVisible();
  await expect(main.getByText("Sort the input ascending.")).toBeVisible();
  await expect(main.getByText("It has no tests.")).toBeVisible();

  // Put it back, through the product.
  await page.goto(editUrl);
  await main.getByRole("button", { name: "Delete this exercise" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("heading", { name: "Delete this exercise?" })).toBeVisible();
  await dialog.getByRole("button", { name: "Delete this exercise" }).click();
  await expect(page.getByText("The exercise was deleted.", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/en\/exercises$/);
});

/**
 * G-019. **The no-recipients path is the half of this that a deployment without SMTP can check**,
 * and a freshly created exercise is exactly the fixture for it: it is assigned in no group, so
 * core-api finds nobody to write to and never reaches the mailer. The non-zero count -- and the
 * mail itself -- stays unverifiable here (Q-007).
 */
test("notifies the teachers who assigned an exercise, and says when there are none", async ({
  page,
}) => {
  await signIn(page, SUPERVISOR, "/en/exercises");
  const main = page.getByRole("main");

  await main.getByLabel("New exercise in").selectOption({ label: "[seed] Intro to Programming" });
  await main.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/en\/exercises\/[0-9a-f-]+\/edit$/);
  const editUrl = page.url();
  expect(trackExercise(editUrl)).not.toBeNull();

  await main.getByLabel("Message").fill("The third test case had the wrong expected output.");
  await main.getByRole("button", { name: "Notify teachers" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("heading", { name: "Send this notification?" })).toBeVisible();
  await dialog.getByRole("button", { name: "Notify teachers" }).click();

  // Nobody has this exercise assigned, which is an answer rather than a failure -- and the reason
  // the message says recipients can also have switched these off.
  await expect(page.getByText("Nobody was notified", { exact: true })).toBeVisible();
  await expect(main.getByLabel("Message")).toHaveValue("");

  // An archived exercise has nothing to announce, and core-api's rule requires `update` which
  // archiving takes away -- so the control is absent rather than offered and refused.
  await main.getByRole("button", { name: "Archive this exercise" }).click();
  await expect(page.getByText("The exercise was archived.", { exact: true })).toBeVisible();
  await expect(main.getByRole("button", { name: "Notify teachers" })).toHaveCount(0);
});

test("is not offered to a student, nor readable by one", async ({ page }) => {
  await signIn(page, STUDENT, "/en/exercises");
  // The catalog itself is already refused, so the create control cannot be there either.
  await expect(page.getByRole("main")).toContainText("Forbidden");
  await expect(page.getByRole("main").getByRole("button", { name: "Create" })).toHaveCount(0);
});
