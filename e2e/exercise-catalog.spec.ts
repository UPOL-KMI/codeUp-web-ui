import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERVISOR } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * The exercise catalog (T-020).
 *
 * Everything asserted here goes through **core-api**, not through a table sorting itself in the
 * browser: the searching, the filtering and the paging are all query parameters, which is the
 * whole design of this screen. The seed provides enough exercises for that to mean something --
 * two pages, tags, and one archived exercise that must stay out of the way until asked for.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

test("narrows the catalog through core-api, not in the browser", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/exercises");
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { name: "Exercises", level: 1 })).toBeVisible();
  // The count is core-api's, and it counts what matched rather than what is on screen.
  await expect(main.getByText(/^Showing 1–20 of \d+\.$/)).toBeVisible();

  await main.getByLabel("Search").fill("Merge Sort");
  await main.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/[?&]q=Merge\+Sort/);
  await expect(main.getByText("Showing 1–1 of 1.")).toBeVisible();
  await expect(main.getByRole("link", { name: "[seed] Merge Sort" })).toBeVisible();
});

test("pages through what the query matched", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/exercises");
  const main = page.getByRole("main");

  const total = Number(
    (await main.getByText(/^Showing 1–20 of \d+\.$/).innerText()).match(/of (\d+)/)![1],
  );
  expect(total).toBeGreaterThan(20);

  await main.getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL(/[?&]page=1$/);
  await expect(main.getByText(`Showing 21–${total} of ${total}.`)).toBeVisible();
  // The last page offers no next one, and the first no previous.
  await expect(main.getByRole("link", { name: "Next" })).toHaveCount(0);
  await main.getByRole("link", { name: "Previous" }).click();
  await expect(main.getByRole("link", { name: "Previous" })).toHaveCount(0);
});

test("keeps archived exercises out of the way until they are asked for", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/exercises?q=Retired");
  const main = page.getByRole("main");
  await expect(main.getByText("Nothing matches those filters.")).toBeVisible();

  await page.goto("/en/exercises?q=Retired&archived=only");
  const row = main.getByRole("row").filter({ hasText: "[seed] Retired Puzzle" });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Archived");
});

test("is not a student's screen", async ({ page }) => {
  await signIn(page, STUDENT, "/en/exercises");
  // core-api's `canViewAll` on exercises: a student reads the assignments made from them, never
  // the catalog itself.
  await expect(page.getByRole("main")).toContainText("Forbidden");
});
