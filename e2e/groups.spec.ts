import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERADMIN } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import type { SeedAccount } from "./helpers/accounts";

async function signIn(page: Page, account: SeedAccount, path = "/en/groups"): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

test.describe("the group list", () => {
  test("shows the reader's own groups and how they relate to them", async ({ page }) => {
    await signIn(page, STUDENT);

    const row = page.getByRole("row", { name: /Intro to Programming/ }).first();
    await expect(row).toBeVisible();
    await expect(row.getByText("Student")).toBeVisible();
  });

  test("filters without a round trip and keeps the filter in the URL", async ({ page }) => {
    await signIn(page, SUPERADMIN);

    const rowsBefore = await page.getByRole("row").count();
    await page.getByPlaceholder("Filter groups").fill("Large Lecture");
    await expect(page).toHaveURL(/groups-q=Large\+Lecture/);
    await expect(page.getByRole("row")).not.toHaveCount(rowsBefore);
    await expect(page.getByRole("row", { name: /Large Lecture/ })).toBeVisible();
  });

  test("marks what kind of group a row is", async ({ page }) => {
    await signIn(page, SUPERADMIN);

    // The instance root is the one public group on this instance. (No seeded group is
    // organizational, so that badge has no data behind it here -- see F-029.)
    const row = page.getByRole("row", { name: /Frankenstein/ }).first();
    await expect(row.getByText("Public")).toBeVisible();
  });

  test("opens a group", async ({ page }) => {
    await signIn(page, STUDENT);

    await page
      .getByRole("main")
      .getByRole("link", { name: "[seed] Intro to Programming", exact: true })
      .click();
    await expect(page).toHaveURL(/\/en\/groups\/[0-9a-f-]+/);
  });

  test("excludes archived groups but links to where they are", async ({ page }) => {
    await signIn(page, SUPERADMIN);

    await expect(page.getByRole("row", { name: /Retired Course/ })).toHaveCount(0);
    await page.getByRole("link", { name: "Archived groups" }).click();
    await expect(page).toHaveURL(/\/en\/archive$/);
  });
});

test.describe("the archive", () => {
  test("lists archived groups and nothing else", async ({ page }) => {
    await signIn(page, SUPERADMIN, "/en/archive");

    await expect(page.getByRole("row", { name: /Retired Course/ })).toBeVisible();
    await expect(page.getByRole("main").getByRole("row", { name: /Large Lecture/ })).toHaveCount(0);
  });

  test("links back to the active groups", async ({ page }) => {
    await signIn(page, SUPERADMIN, "/en/archive");

    await page.getByRole("link", { name: "Active groups" }).click();
    await expect(page).toHaveURL(/\/en\/groups$/);
  });
});

test.describe("the group detail", () => {
  test("shows what the group is, who runs it and what it contains", async ({ page }) => {
    await signIn(page, STUDENT);
    await page
      .getByRole("main")
      .getByRole("link", { name: /Intro to Programming$/ })
      .click();

    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "[seed] Intro to Programming" })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Details" })).toBeVisible();
    // Sam and the superadmin administer this group; both come from one batched user lookup.
    await expect(main.getByRole("link", { name: "Sam Supervisor" })).toBeVisible();
    // A student sees where they stand.
    await expect(main.getByRole("heading", { name: "My standing" })).toBeVisible();
  });

  test("links up to the parent group and down to the subgroup", async ({ page }) => {
    await signIn(page, SUPERADMIN);
    await page
      .getByRole("main")
      .getByRole("link", { name: /Intro to Programming$/ })
      .click();
    const main = page.getByRole("main");

    await expect(main.getByRole("heading", { name: "Subgroups" })).toBeVisible();
    await main.getByRole("link", { name: /Lab A/ }).click();
    await expect(main.getByRole("heading", { name: /Lab A/ })).toBeVisible();

    // ...and back up, through the parent row.
    await main.getByRole("link", { name: "[seed] Intro to Programming", exact: true }).click();
    await expect(main.getByRole("heading", { name: "[seed] Intro to Programming" })).toBeVisible();
  });

  test("falls back to the info tab for an unknown tab rather than failing", async ({ page }) => {
    await signIn(page, STUDENT);
    await page
      .getByRole("main")
      .getByRole("link", { name: /Intro to Programming$/ })
      .click();
    await expect(page).toHaveURL(/\/en\/groups\/[0-9a-f-]+/);

    await page.goto(`${new URL(page.url()).pathname}?tab=nonsense`);
    await expect(
      page.getByRole("main").getByRole("heading", { name: "Description" }),
    ).toBeVisible();
  });
});
