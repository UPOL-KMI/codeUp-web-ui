import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERADMIN } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import { deleteGroupIfPresent } from "./helpers/core-api";

/**
 * Bringing a group into existence, and a subgroup of one (G-008).
 *
 * **Every test here cleans up in a `finally`, through core-api rather than through the screen.**
 * A group this suite leaves behind does not break a later run -- the names carry a per-run suffix
 * -- but it lands in the sidebar of every superadmin page and in the group list every other spec
 * reads, and somebody has to remove it by hand. Deleting the subgroup first is not tidiness: core-
 * api refuses to delete a group that still has children, which is the same rule the settings
 * screen's own explanation states.
 *
 * Nothing asserts a count of groups: these run in parallel with the rest of the suite, and for part
 * of that time each has a group of its own alive.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

/** The group id out of the URL the dialog lands on. */
function groupIdFrom(url: string): string {
  const id = new URL(url).pathname.split("/").at(-1);
  if (id === undefined) throw new Error(`no group id in ${url}`);
  return id;
}

test("creates a group and lands on the settings tab, where it can be configured", async ({
  page,
}) => {
  const name = `[e2e] Course ${Date.now()}`;
  await signIn(page, SUPERADMIN, "/en/groups");

  let groupId: string | null = null;
  try {
    await page.getByRole("button", { name: "New group" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name (en)").fill(name);
    await dialog.getByLabel("Name (cs)").fill(`${name} cs`);
    await dialog.getByRole("button", { name: "Create the group" }).click();

    // DEC-093's shape: created plain, then configured. The landing screen is the proof.
    await expect(page).toHaveURL(/\/en\/groups\/[0-9a-f-]+\?tab=settings/);
    groupId = groupIdFrom(page.url());
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name })).toBeVisible();
    // The settings form is there and already holds what the dialog collected.
    await expect(main.getByRole("textbox").first()).toHaveValue(name);

    // And it is a real group, reachable from the list it was created on.
    await page.goto("/en/groups");
    await expect(
      page.getByRole("row", { name: new RegExp(name.replace(/[[\]]/g, "\\$&")) }),
    ).toHaveCount(1);
  } finally {
    if (groupId !== null) await deleteGroupIfPresent(groupId);
  }
});

test("creates a subgroup from the group it belongs to", async ({ page }) => {
  const parentName = `[e2e] Parent ${Date.now()}`;
  await signIn(page, SUPERADMIN, "/en/groups");

  let parentId: string | null = null;
  let childId: string | null = null;
  try {
    await page.getByRole("button", { name: "New group" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name (en)").fill(parentName);
    await dialog.getByLabel("Name (cs)").fill(`${parentName} cs`);
    await dialog.getByRole("button", { name: "Create the group" }).click();
    await expect(page).toHaveURL(/tab=settings/);
    parentId = groupIdFrom(page.url());

    // The subgroup control lives on the Info tab, beside the list it adds to -- and it is offered
    // on a group with no subgroups at all, which is exactly when it is needed.
    await page.goto(`/en/groups/${parentId}`);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "Subgroups" })).toBeVisible();
    await expect(main.getByText("This group has no subgroups.")).toBeVisible();

    await main.getByRole("button", { name: "New subgroup" }).click();
    const subDialog = page.getByRole("dialog");
    await expect(subDialog.getByRole("heading", { name: "New subgroup" })).toBeVisible();
    await subDialog.getByLabel("Name (en)").fill(`${parentName} / Lab`);
    await subDialog.getByRole("button", { name: "Create the group" }).click();
    await expect(page).toHaveURL(/tab=settings/);
    childId = groupIdFrom(page.url());
    expect(childId).not.toBe(parentId);

    // The hierarchy really nests: the child is listed under its parent.
    await page.goto(`/en/groups/${parentId}`);
    await expect(main.getByRole("link", { name: `${parentName} / Lab` })).toBeVisible();
  } finally {
    if (childId !== null) await deleteGroupIfPresent(childId);
    if (parentId !== null) await deleteGroupIfPresent(parentId);
  }
});

test("refuses the name that is blank in every language, without asking core-api", async ({
  page,
}) => {
  await signIn(page, SUPERADMIN, "/en/groups");

  await page.getByRole("button", { name: "New group" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Create the group" }).click();

  await expect(dialog.getByRole("alert")).toContainText("at least one language");
  // Still open, so nothing was created and the typing is not lost.
  await expect(dialog).toBeVisible();
});

test("is offered to nobody who may not add a group", async ({ page }) => {
  await signIn(page, STUDENT, "/en/groups");

  await expect(page.getByRole("button", { name: "New group" })).toHaveCount(0);

  // ...and not on a group they merely study in, either.
  await page
    .getByRole("main")
    .getByRole("link", { name: /Intro to Programming$/ })
    .click();
  await expect(page).toHaveURL(/\/en\/groups\/[0-9a-f-]+/);
  await expect(page.getByRole("button", { name: "New subgroup" })).toHaveCount(0);
});
