import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERVISOR } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * One exercise, read (T-021).
 *
 * The two states worth asserting are the two a teacher actually meets: an exercise that is ready
 * to assign, and one that is not -- where the whole value of the screen is that it says **which
 * parts are missing** rather than showing a red badge. The seed provides both.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

test("the catalog leads to an exercise, and the exercise says what it is", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/exercises?q=Echo");
  const main = page.getByRole("main");

  await main.getByRole("link", { name: "[seed] Echo Greeting" }).click();
  await expect(page).toHaveURL(/\/en\/exercises\/[0-9a-f-]+$/);
  await expect(main.getByRole("heading", { name: "[seed] Echo Greeting", level: 1 })).toBeVisible();

  // What a student would be asked to do, rendered as the markdown it is authored in.
  await expect(main.getByText("Read a line and print exactly: Hello, ReCodEx!")).toBeVisible();

  // The details a teacher decides on, including how many assignments already came from it --
  // core-api counts only the ones this reader may see.
  await expect(main.getByRole("heading", { name: "Details", level: 2 })).toBeVisible();
  await expect(main.getByText("Python", { exact: true })).toBeVisible();
  await expect(main.getByText(/\d+ assignments?/)).toBeVisible();

  // The evaluation's own files, which students never see.
  await expect(main.getByText("expected.txt")).toBeVisible();
});

test("an exercise that cannot be assigned says which parts are missing", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/exercises?q=Merge+Sort");
  const main = page.getByRole("main");
  await main.getByRole("link", { name: "[seed] Merge Sort" }).click();

  await expect(
    main.getByRole("heading", { name: "This exercise cannot be assigned yet" }),
  ).toBeVisible();
  // core-api's `@no-runtimes`/`@no-hwgroups`/`@no-tests` in words, not as a red badge alone.
  await expect(main.getByText("No language has been selected for it.")).toBeVisible();
  await expect(main.getByText("It has no tests.")).toBeVisible();
  await expect(main.getByText("Not assigned anywhere")).toBeVisible();
});

test("is not a student's screen", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/exercises?q=Echo");
  await page.getByRole("main").getByRole("link", { name: "[seed] Echo Greeting" }).click();
  await expect(page).toHaveURL(/\/en\/exercises\/[0-9a-f-]+$/);
  const url = page.url();

  await page.context().clearCookies();
  await signIn(page, STUDENT, url);
  // The same `canViewDetail` that keeps the catalog itself from a student.
  await expect(page.getByRole("main")).toContainText("Forbidden");
});
