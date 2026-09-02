import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERADMIN, SUPERVISOR } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * The instances this deployment runs, and what a superadmin does to one (AD-004, AD-005, AD-008).
 *
 * **The seeded instance is never mutated.** It is the one every other spec signs into, and its
 * settings are deployment-wide -- closing its registration or deleting it would take the suite
 * with it. So the tests that change anything create their own instance first and remove it
 * afterwards, which is also the only way to exercise deletion at all: the screen does not offer it
 * for the instance the reader's own account belongs to.
 *
 * Nothing asserts a count of instances: these tests run in parallel with each other, and one of
 * them has an instance of its own alive for part of that time.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

/** Creates an instance through the dialog and leaves the browser on its own screen. */
async function createInstance(page: Page, name: string): Promise<void> {
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Create an instance" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Description").fill("Created by the e2e suite.");
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(main.getByRole("heading", { name, level: 1 })).toBeVisible();
}

async function deleteCurrentInstance(page: Page): Promise<void> {
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Delete instance" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete instance" }).click();
  await expect(page).toHaveURL(/\/en\/admin\/instances$/);
}

test("lists the instances with who runs them", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/admin/instances");
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { name: "Instances", level: 1 })).toBeVisible();
  const row = main.getByRole("row").filter({ hasText: "Frankenstein University" });
  await expect(row).toContainText("Admin Admin");
  await expect(row).toContainText("Open for registration");
});

test("says an instance needs no licence rather than claiming it has one", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/admin/instances");
  await page
    .getByRole("main")
    .getByRole("link", { name: /Frankenstein University/ })
    .click();
  const main = page.getByRole("main");

  // core-api computes hasValidLicence as `needsLicence === false || validLicences > 0` and does not
  // publish `needsLicence`, so "covered" with an empty table is the one case that has to be
  // inferred rather than read.
  await expect(main.getByText("does not require a licence at all")).toBeVisible();
  await expect(main.getByText("This instance has no licences at all.")).toBeVisible();
  // The name is the root group's, so this screen points at it instead of offering a field.
  await expect(main.getByRole("link", { name: "Open the root group" })).toBeVisible();
});

test("never offers to delete the instance the reader belongs to", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/admin/instances");
  await page
    .getByRole("main")
    .getByRole("link", { name: /Frankenstein University/ })
    .click();
  const main = page.getByRole("main");

  await expect(main.getByRole("button", { name: "Delete instance" })).toHaveCount(0);
  await expect(main.getByText("This is the instance your own account belongs to")).toBeVisible();
  // The one setting core-api's update endpoint actually accepts is still offered.
  await expect(main.getByRole("button", { name: "Close registration" })).toBeVisible();
});

test("creates an instance, opens and closes it, and deletes it again", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/admin/instances");
  const main = page.getByRole("main");
  const name = `e2e instance ${Date.now()}`;

  await createInstance(page, name);
  // Created closed, since the dialog's checkbox was left alone.
  await expect(main.getByText("This instance is closed")).toBeVisible();

  await main.getByRole("button", { name: "Open for registration" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Open for registration" })
    .click();
  await expect(main.getByText("People may register into this instance themselves.")).toBeVisible();

  await deleteCurrentInstance(page);
  await expect(main.getByRole("row").filter({ hasText: name })).toHaveCount(0);
});

test("adds a licence and removes it", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/admin/instances");
  const main = page.getByRole("main");
  const name = `e2e licence ${Date.now()}`;

  await createInstance(page, name);

  await main.getByLabel("Note").fill("e2e licence");
  await main.getByLabel("Valid until").fill("2099-12-31T23:59");
  await main.getByRole("button", { name: "Add licence" }).click();
  const row = main.getByRole("row").filter({ hasText: "e2e licence" });
  await expect(row).toContainText("Valid");
  await expect(main.getByText("A valid licence covers this instance.")).toBeVisible();

  // No revoke control, and the reason is core-api's: `isValid: false` is read as "not provided"
  // and silently ignored, so a licence can be set valid and never invalid (Q-022). This assertion
  // is what caught the button that had been built here.
  await expect(row.getByRole("button", { name: "Revoke" })).toHaveCount(0);

  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(main.getByText("This instance has no licences at all.")).toBeVisible();

  await deleteCurrentInstance(page);
});

test("is an admin section route, whatever core-api lets anyone read", async ({ page }) => {
  await signIn(page, STUDENT, "/en/admin/instances");
  const main = page.getByRole("main");
  // Reading instances is public in core-api -- this refusal is about `/admin/*` being a section
  // with an audience, not about the names being secret.
  await expect(main).toContainText("Forbidden");

  await signIn(page, SUPERVISOR, "/en/admin/instances");
  await expect(main).toContainText("Forbidden");
});
