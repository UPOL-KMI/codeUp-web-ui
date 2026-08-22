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
