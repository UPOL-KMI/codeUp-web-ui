import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERVISOR } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * The assignments made from one exercise (T-012).
 *
 * Reading uses the seeded exercise, which is assigned in several groups. The assigning half
 * creates real assignments and deletes them again through the product, the way T-001's spec does
 * -- an assignment left behind would change what the group screens and the points matrix count.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

test("lists where an exercise is already assigned", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/exercises?q=Echo");
  const main = page.getByRole("main");

  await main.getByRole("link", { name: "[seed] Echo Greeting" }).click();
  await main.getByRole("link", { name: "Where it is assigned" }).click();
  await expect(
    main.getByRole("heading", { name: "Assignments from this exercise", level: 1 }),
  ).toBeVisible();

  // One row per assignment the reader may see -- core-api filters the list itself.
  const rows = main.getByRole("row");
  await expect(rows.filter({ hasText: "[seed] Intro to Programming" }).first()).toBeVisible();

  // A row leads to the assignment it names.
  await main.getByRole("row").nth(1).getByRole("link").first().click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+$/);
});

test("assigns to several groups at once, and each one stands on its own", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/exercises?q=Echo");
  const main = page.getByRole("main");

  await main.getByRole("link", { name: "[seed] Echo Greeting" }).click();
  await main.getByRole("link", { name: "Where it is assigned" }).click();
  await expect(
    main.getByRole("heading", { name: "Assignments from this exercise", level: 1 }),
  ).toBeVisible();
  await expect(main.getByRole("row").first()).toBeVisible();

  const before = await main.getByRole("row").count();

  await main.getByRole("checkbox", { name: /Intro to Programming \/ Lab A/ }).check();
  await main.getByRole("button", { name: "Assign to 1 group" }).click();
  await expect(page.getByText("1 assignment was created.", { exact: true })).toBeVisible();

  // The new assignment shows up, invisible to students until somebody configures it.
  await expect(main.getByRole("row")).toHaveCount(before + 1);
  await expect(main.getByText("Not visible to students").first()).toBeVisible();

  // Put it back, through the product: the newest row for Lab A is the one just made.
  await main.getByRole("row").filter({ hasText: "Lab A" }).last().getByRole("link").first().click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+$/);
  await main.getByRole("link", { name: "Edit assignment" }).click();
  await main.getByRole("button", { name: "Delete this assignment" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("The assignment was deleted.", { exact: true })).toBeVisible();
});

test("is refused to a student", async ({ page }) => {
  await signIn(page, STUDENT, "/en/exercises");
  await expect(page.getByRole("main")).toContainText("Forbidden");
});
