import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERADMIN, SUPERVISOR } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * Editing somebody else's account (AD-002).
 *
 * **Nothing here is reachable on one's own account**, and the three checks that enforce that are
 * core-api's rather than this app's: `setRole` and `setIsAllowed` refuse the current user outright,
 * and a *forced* password change on oneself is refused by a rule outranking the superadmin's
 * blanket allow. The route answers by redirecting an administrator to their own settings screen,
 * which is what the first test asserts.
 *
 * Accounts are reached by clicking rather than by hardcoded id -- the directory, then the profile,
 * then its edit link -- so the path a person actually takes is what runs.
 *
 * Both mutating tests put back what they changed and can run twice: the role returns to `student`,
 * and the password is set to the value the seed already uses.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

/** The directory -> the person -> their edit screen, which is how an administrator gets here. */
async function openEditScreen(page: Page, email: string): Promise<void> {
  const main = page.getByRole("main");
  await page.goto(`/en/users?q=${encodeURIComponent(email)}`);
  await main.getByRole("row").filter({ hasText: email }).getByRole("link").first().click();
  await main.getByRole("link", { name: "Edit this account" }).click();
  await expect(main.getByRole("heading", { name: "Profile", level: 2 })).toBeVisible();
}

test("offers an administrator every part of an account core-api discloses", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/users");
  await openEditScreen(page, "seed.filler.19@seed.recodex.local");
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { name: "Role", level: 2 })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Password", level: 2 })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Access", level: 2 })).toBeVisible();

  // The password form here never asks for the old one -- that is the whole difference from the
  // reader's own settings screen.
  await expect(main.getByLabel("Current password")).toHaveCount(0);
  // Notification settings are attached to `privateData` only for the account's owner, so there is
  // nothing here to render and no section claiming otherwise.
  await expect(main.getByRole("heading", { name: "Notifications" })).toHaveCount(0);
  // The account is local, so core-api would refuse a second local login and the control is absent.
  await expect(main.getByRole("button", { name: "Add a password login" })).toHaveCount(0);
});

test("sends an administrator editing themselves to their own settings", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/users?q=admin@admin.com");
  const main = page.getByRole("main");

  const href = await main
    .getByRole("row")
    .filter({ hasText: "Admin Admin" })
    .getByRole("link", { name: "Admin Admin" })
    .getAttribute("href");
  const ownId = href!.split("/").pop()!;

  await page.goto(`/en/users/${ownId}/edit`);
  // Not a refusal and not a broken screen: the one thing that would work there already lives here.
  await expect(page).toHaveURL(/\/en\/profile\/edit$/);
  await expect(main.getByLabel("Current password")).toBeVisible();
});

test("changes a role, saying what it becomes, and puts it back", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/users");
  await openEditScreen(page, "seed.filler.21@seed.recodex.local");
  const main = page.getByRole("main");
  const role = main.getByRole("combobox", { name: "Role" });

  await expect(role).toHaveValue("student");
  await role.selectOption("supervisor");
  await main.getByRole("button", { name: "Change role" }).click();
  // The confirmation names both roles rather than asking whether the reader is sure.
  await expect(page.getByRole("alertdialog")).toContainText("Student becomes Supervisor");
  await page.getByRole("alertdialog").getByRole("button", { name: "Change role" }).click();
  await expect(role).toHaveValue("supervisor");

  await role.selectOption("student");
  await main.getByRole("button", { name: "Change role" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Change role" }).click();
  await expect(role).toHaveValue("student");
});

test("sets a password without the old one and keeps the administrator signed in", async ({
  page,
}) => {
  await signIn(page, SUPERADMIN, "/en/users");
  await openEditScreen(page, "seed.filler.20@seed.recodex.local");
  const main = page.getByRole("main");

  // The seed's own password, so this is idempotent: the account works the same afterwards.
  await main.getByLabel("New password", { exact: true }).fill("RecodexSeed123!");
  await main.getByLabel("New password again").fill("RecodexSeed123!");
  await main.getByRole("button", { name: "Set password" }).click();

  // core-api stamps the validity threshold on the *edited* account, not on the caller's -- so the
  // administrator is still signed in, which is the half of this that is easy to get wrong.
  await expect(main.getByRole("heading", { name: "Access", level: 2 })).toBeVisible();
  await page.goto("/en/users");
  await expect(main.getByText(/^Showing 1–20 of \d+\.$/)).toBeVisible();
});

test("ends every session of an account without disabling it", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/users");
  await openEditScreen(page, "seed.filler.18@seed.recodex.local");
  const main = page.getByRole("main");

  await expect(main.getByText("This account is in use.")).toBeVisible();
  await main.getByRole("button", { name: "Sign out everywhere" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Sign out everywhere" }).click();
  // Signing out is not disabling: the account is still in use, and the person can sign back in.
  await expect(main.getByText("This account is in use.")).toBeVisible();
  await expect(main.getByRole("button", { name: "Disable" })).toBeVisible();
});

test("is nobody else's screen, and nobody else is offered the link to it", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/users?q=seed.filler.17@seed.recodex.local");
  const main = page.getByRole("main");

  await main
    .getByRole("row")
    .filter({ hasText: "seed.filler.17@" })
    .getByRole("link")
    .first()
    .click();
  // Wait for the profile itself: the assertion below passes on the list too, so without this the
  // address read afterwards would still be the list's.
  await page.waitForURL(/\/users\/[0-9a-f-]{36}$/);
  // A supervisor may read the profile -- `viewDetail` is theirs -- and is offered no way to edit it.
  await expect(main.getByRole("link", { name: "Edit this account" })).toHaveCount(0);

  await page.goto(`${page.url()}/edit`);
  // core-api would let the *read* through, so the refusal is this screen's own (DEC-110).
  await expect(main).toContainText("Forbidden");

  await signIn(page, STUDENT, "/en/users");
  await expect(main).toContainText("Forbidden");
});
