import { test, expect } from "@playwright/test";

import { STUDENT, SUPERADMIN } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * Assigning an exercise to a group (T-001) -- the only way an assignment comes into existence.
 *
 * The happy path **creates a real assignment and deletes it again**, because there is no other
 * shape this test can take: creating is the thing being tested, and an extra assignment left in
 * the seeded group would change what every dashboard and group-screen assertion counts. It is
 * deleted through the product's own settings screen, so nothing here reaches past the UI.
 *
 * The assignment is left invisible throughout -- core-api creates it that way and this test never
 * makes it public -- so no student ever sees it, even in the window it exists.
 */
async function openAssignmentsTab(page: import("@playwright/test").Page) {
  await page.goto("/en/groups");
  await page
    .getByRole("main")
    .getByRole("link", { name: "[seed] Intro to Programming", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "[seed] Intro to Programming", level: 1 }),
  ).toBeVisible();
  await page.goto(`${page.url().split("?")[0]}?tab=assignments`);
}

test("assigns an exercise, lands on its settings, and removes it again", async ({ page }) => {
  const cookie = await loginAndGetCookie(SUPERADMIN);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await openAssignmentsTab(page);

  await page.getByRole("main").getByRole("link", { name: "Assign an exercise" }).click();
  await expect(page).toHaveURL(/\/en\/groups\/[0-9a-f-]+\/assign$/);

  const main = page.getByRole("main");

  // The search is core-api's, not a filter over what was already fetched -- and it was silently
  // doing nothing until T-020 found that `?search=` is not the parameter core-api reads
  // (`filters[search]` is). Asserting on an exercise that must *disappear* is what makes this a
  // test of the search rather than of the list.
  await main.getByPlaceholder("Search by name").fill("Echo");
  await main.getByRole("button", { name: "Search" }).click();
  await expect(main.getByRole("listitem").filter({ hasText: "[seed] Merge Sort" })).toHaveCount(0);

  const row = main.getByRole("listitem").filter({ hasText: "[seed] Echo Greeting" });
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: "Assign" }).click();

  // core-api has no call that creates an assignment *and* configures it, so the reader is put
  // where the deadline and the points are, with the assignment already real.
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+\/edit$/);
  await expect(main.getByRole("heading", { name: "Assignment settings", level: 1 })).toBeVisible();
  // Created invisible, which is why this is safe to do against a group students can see.
  await expect(main.getByLabel("Students can see this assignment")).not.toBeChecked();

  // Put it back, through the product: deletion sits at the bottom of the same settings screen,
  // which is where T-001's one-way door was closed.
  await main.getByRole("button", { name: "Delete this assignment" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("heading", { name: "Delete this assignment?" })).toBeVisible();
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("The assignment was deleted.", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/en\/groups\/[0-9a-f-]+\?tab=assignments$/);
});

test("is neither offered to a student nor readable by one", async ({ page }) => {
  const cookie = await loginAndGetCookie(STUDENT);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await openAssignmentsTab(page);

  await expect(
    page.getByRole("main").getByRole("link", { name: "Assign an exercise" }),
  ).toHaveCount(0);

  await page.goto(`${page.url().split("?")[0]}/assign`);
  await expect(page.getByRole("main")).toContainText("Forbidden");
});
