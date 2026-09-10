import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERADMIN } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import {
  firstSeededSolution,
  restoreSolutionVerdict,
  SEEDED_CORRECT_NOTE,
} from "./helpers/core-api";

/**
 * The teacher's verdict on a solution: which attempt counts, and what it is worth (G-001).
 *
 * **These tests mutate a seeded solution and put it back**, rather than creating one of their own:
 * submitting a solution and waiting for it to be evaluated is S-014's ground, and on this host no
 * evaluation can succeed at all (DEC-031), so a freshly created solution would be in a state no
 * teacher ever sees. The `finally` restores both fields to the values the seed leaves -- not
 * accepted, no override, no bonus -- so the run is idempotent and every other spec reading that
 * solution sees what it expects.
 *
 * The accepted flag is deliberately exercised on a solution that is the author's only one here: it
 * is unique per author per assignment, so setting it on one clears it on another, and a test that
 * moved it between attempts would be asserting core-api's bookkeeping rather than this screen's.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

test("awards points the evaluation did not, and clears them again", async ({ page }) => {
  const { id, maxPoints } = await firstSeededSolution(SEEDED_CORRECT_NOTE);
  try {
    await signIn(page, SUPERADMIN, `/en/solutions/${id}`);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "The teacher's verdict" })).toBeVisible();

    // The one-click shortcut a teacher uses after fixing a broken test.
    await main.getByRole("button", { name: `Award full marks (${maxPoints})` }).click();
    await expect(main.getByText(`${maxPoints}/${maxPoints}`).first()).toBeVisible();

    // And the number in between, typed.
    await main.getByLabel("Points instead of the evaluated ones").fill("3");
    await main.getByLabel("Bonus", { exact: true }).fill("2");
    await main.getByRole("button", { name: "Save the points" }).click();
    await expect(main.getByText(`3/${maxPoints}`).first()).toBeVisible();
    await expect(main.getByText("+2")).toBeVisible();

    // Clearing hands the solution back to whatever the evaluation said.
    await main.getByRole("button", { name: "Clear the award" }).click();
    await expect(main.getByLabel("Points instead of the evaluated ones")).toHaveValue("");
  } finally {
    await restoreSolutionVerdict(id);
  }
});

test("accepts an attempt, saying first that it moves the flag", async ({ page }) => {
  const { id } = await firstSeededSolution(SEEDED_CORRECT_NOTE);
  try {
    await signIn(page, SUPERADMIN, `/en/solutions/${id}`);
    const main = page.getByRole("main");

    await main.getByRole("button", { name: "Accept this attempt" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("only one attempt at an assignment can be");
    await dialog.getByRole("button", { name: "Accept it" }).click();

    await expect(main.getByText("Accepted")).toBeVisible();
    await expect(main.getByRole("button", { name: "Stop accepting this attempt" })).toBeVisible();

    // ...and taking it back needs no confirmation, because it removes nothing from elsewhere.
    await main.getByRole("button", { name: "Stop accepting this attempt" }).click();
    await expect(main.getByRole("button", { name: "Accept this attempt" })).toBeVisible();
  } finally {
    await restoreSolutionVerdict(id);
  }
});

test("is offered to no student, on their own solution or anyone else's", async ({ page }) => {
  await signIn(page, STUDENT, "/en/dashboard");
  await page
    .getByRole("main")
    .getByRole("link", { name: /Intro to Programming$/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/en\/groups\/[0-9a-f-]+/);

  const { id } = await firstSeededSolution(SEEDED_CORRECT_NOTE);
  await page.goto(`/en/solutions/${id}`);
  // Either refused outright or shown without the verdict -- never shown with it.
  await expect(page.getByRole("heading", { name: "The teacher's verdict" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Accept this attempt" })).toHaveCount(0);
});
