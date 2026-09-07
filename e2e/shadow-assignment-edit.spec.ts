import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERADMIN } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import { deleteShadowAssignmentIfPresent } from "./helpers/core-api";

/**
 * Making a shadow assignment, changing it and removing it (G-009).
 *
 * **Everything here creates its own**, because the two the seed leaves are read by other specs --
 * the group screen's list, the student dashboard's rows (S-025) and the points table (T-024) all
 * count on them being what the seed made. A shadow assignment created here is deleted in a
 * `finally`, through core-api where the screen's own deletion is not what is under test.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

/** Presses the group's create button and returns the id of what it made. */
async function createFromGroup(page: Page): Promise<string> {
  await page
    .getByRole("main")
    .getByRole("link", { name: /Intro to Programming$/ })
    .click();
  await expect(page).toHaveURL(/\/en\/groups\/[0-9a-f-]+/);
  await page.getByRole("link", { name: "Assignments", exact: true }).click();

  await page.getByRole("button", { name: "New shadow assignment" }).click();
  // Nothing is asked, because core-api's create takes a group and nothing else: it lands straight
  // on the settings screen, which is where the name and the points are typed.
  await expect(page).toHaveURL(/\/en\/shadow-assignments\/[0-9a-f-]+\/edit$/, { timeout: 15_000 });

  const id = new URL(page.url()).pathname.split("/").at(-2);
  if (id === undefined) throw new Error("no shadow assignment id after creating");
  return id;
}

test("creates one from the group, names it, and shows it in the group's list", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/groups");
  let shadowId: string | null = null;
  try {
    shadowId = await createFromGroup(page);
    const main = page.getByRole("main");

    const name = `[e2e] Oral exam ${Date.now()}`;
    await main.getByLabel("Name").first().fill(name);
    await main.getByLabel("Points it is worth").fill("15");
    await main.getByLabel("Students can see it").check();
    await main.getByRole("button", { name: "Save the settings" }).click();
    await expect(page.getByText("The settings were saved.", { exact: true })).toBeVisible();

    // It is a real shadow assignment now: named, worth something, and listed where it belongs.
    await page.goto(`/en/shadow-assignments/${shadowId}`);
    await expect(main.getByRole("heading", { name })).toBeVisible();

    await page.goBack();
    await page.getByRole("link", { name: "Back to the assignment" }).click();
    await expect(main.getByRole("link", { name })).toBeVisible();
  } finally {
    if (shadowId !== null) await deleteShadowAssignmentIfPresent(shadowId);
  }
});

test("refuses a link that is not an address, before core-api is asked", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/groups");
  let shadowId: string | null = null;
  try {
    shadowId = await createFromGroup(page);
    const main = page.getByRole("main");

    await main.getByLabel("Name").first().fill("[e2e] bad link");
    const link = main.getByLabel("Link").first();
    await link.fill("not-an-address");
    await main.getByRole("button", { name: "Save the settings" }).click();

    // Refused by the field itself: it is `type="url"`, so the browser stops the submit before the
    // form's own rule is reached, and core-api -- which refuses the same value with a 400 -- is
    // never asked. The schema's rule is still the one that matters, since a Server Action is a
    // public endpoint whatever the browser did.
    await expect(link).toHaveJSProperty("validity.valid", false);
    await expect(page.getByText("The settings were saved.", { exact: true })).toHaveCount(0);

    // ...and a real address is accepted by the same field.
    await link.fill("https://example.org/oral-exam");
    await main.getByRole("button", { name: "Save the settings" }).click();
    await expect(page.getByText("The settings were saved.", { exact: true })).toBeVisible();
  } finally {
    if (shadowId !== null) await deleteShadowAssignmentIfPresent(shadowId);
  }
});

test("deletes one, saying first that the awarded points go with it", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/groups");
  let shadowId: string | null = null;
  try {
    shadowId = await createFromGroup(page);
    const main = page.getByRole("main");
    await main.getByLabel("Name").first().fill("[e2e] to be deleted");
    await main.getByRole("button", { name: "Save the settings" }).click();
    await expect(page.getByText("The settings were saved.", { exact: true })).toBeVisible();

    await main.getByRole("button", { name: "Delete this shadow assignment" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("The points every student was awarded for it go with it");
    await dialog.getByRole("button", { name: "Delete it" }).click();

    await expect(page).toHaveURL(/\/en\/groups\/[0-9a-f-]+\?tab=assignments$/, { timeout: 15_000 });
    await page.goto(`/en/shadow-assignments/${shadowId}`);
    await expect(page.getByRole("heading", { name: "[e2e] to be deleted" })).toHaveCount(0);
  } finally {
    if (shadowId !== null) await deleteShadowAssignmentIfPresent(shadowId);
  }
});

test("is offered to no student, neither the button nor the screen", async ({ page }) => {
  await signIn(page, STUDENT, "/en/groups");
  await page
    .getByRole("main")
    .getByRole("link", { name: /Intro to Programming$/ })
    .click();
  await page.getByRole("link", { name: "Assignments", exact: true }).click();

  await expect(page.getByRole("button", { name: "New shadow assignment" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
});
