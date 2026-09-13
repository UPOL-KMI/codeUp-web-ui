import { test, expect } from "@playwright/test";

import { STUDENT, SUPERADMIN } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * The group's settings tab (S-009).
 *
 * Every assertion here is about a *reversible* change made through the UI and then undone through
 * it: this suite runs against the same seeded instance every other spec reads, so a test that left
 * a group renamed, archived or moved would quietly change what those specs see.
 */
async function openSettings(page: import("@playwright/test").Page, groupName: string) {
  await page.goto("/en/groups");
  await page.getByRole("main").getByRole("link", { name: groupName, exact: true }).click();
  await expect(page).toHaveURL(/\/en\/groups\/[0-9a-f-]+/);
  await page.goto(`${page.url().split("?")[0]}?tab=settings`);
}

test("saves a setting and puts it back", async ({ page }) => {
  const cookie = await loginAndGetCookie(SUPERADMIN);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await openSettings(page, "[seed] Large Lecture");

  const main = page.getByRole("main");
  const externalId = main.getByLabel("External identifier");

  await externalId.fill("E2E-TEMP");
  await main.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("The settings were saved.", { exact: true })).toBeVisible();

  await page.reload();
  await expect(main.getByLabel("External identifier")).toHaveValue("E2E-TEMP");

  await main.getByLabel("External identifier").fill("");
  await main.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("The settings were saved.", { exact: true })).toBeVisible();
});

test("adds a person to the group and removes them again", async ({ page }) => {
  const cookie = await loginAndGetCookie(SUPERADMIN);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await openSettings(page, "[seed] Large Lecture");

  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: /^Students/ })).toBeVisible();

  // Self-healing: a run that failed between adding and removing would otherwise leave the newcomer
  // in the group, and the picker deliberately hides people who are already members.
  const alreadyThere = main.getByRole("listitem").filter({ hasText: "Nora Newcomer" });
  if ((await alreadyThere.count()) > 0) {
    await alreadyThere.first().getByRole("button", { name: "Remove" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("The student was removed.", { exact: true })).toBeVisible();
  }

  // The seeded newcomer belongs to no group at all, which is what makes them safe to add here.
  await main.getByLabel("Add a student").fill("Newcomer");
  const hit = main.getByRole("listitem").filter({ hasText: "Nora Newcomer" });
  await hit.first().getByRole("button", { name: "Add as student" }).click();
  await expect(page.getByText("The student was added.", { exact: true })).toBeVisible();

  // Removing somebody confirms first -- a one-click removal in a list is a mis-click waiting to
  // land on the wrong row.
  const added = main.getByRole("listitem").filter({ hasText: "Nora Newcomer" });
  await added.first().getByRole("button", { name: "Remove" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Nora Newcomer");
  await dialog.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("The student was removed.", { exact: true })).toBeVisible();
});

test("the settings tab is not offered to a student", async ({ page }) => {
  const cookie = await loginAndGetCookie(STUDENT);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto("/en/groups");
  await page
    .getByRole("main")
    .getByRole("link", { name: "[seed] Intro to Programming", exact: true })
    .click();

  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: "Info" })).toBeVisible();
  await expect(main.getByRole("link", { name: "Settings" })).toHaveCount(0);

  // And asking for it directly falls back to Info rather than showing a stub or an error.
  await page.goto(`${page.url().split("?")[0]}?tab=settings`);
  await expect(main.getByRole("heading", { name: "Description" })).toBeVisible();
  await expect(main.getByRole("button", { name: "Save settings" })).toHaveCount(0);
});
