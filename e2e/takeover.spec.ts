import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERADMIN, SUPERVISOR } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * Signing in as somebody else (AD-003).
 *
 * **The thing being asserted is that the session really changed**, not that a button did something:
 * core-api issues an ordinary token for the target and this app's whole shell is built from whoever
 * the session says you are, so the proof is the Administration section disappearing from the
 * sidebar and `/users` answering with a refusal afterwards.
 *
 * Nothing here needs putting back -- a takeover mutates no data, and every test gets its own
 * browser context and its own cookie.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

/** Somebody's profile, reached from the directory the way an administrator reaches it. */
async function openProfile(page: Page, email: string): Promise<void> {
  await page.goto(`/en/users?q=${encodeURIComponent(email)}`);
  await page
    .getByRole("main")
    .getByRole("row")
    .filter({ hasText: email })
    .getByRole("link")
    .first()
    .click();
  await page.waitForURL(/\/users\/[0-9a-f-]{36}$/);
}

test("becomes the person, all the way down to the sidebar", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/users");
  await openProfile(page, "alice.student@seed.recodex.local");
  const main = page.getByRole("main");

  await main.getByRole("button", { name: "Sign in as this person" }).click();
  // The confirmation says what it is, because it is not reversible from inside the app.
  await expect(page.getByRole("alertdialog")).toContainText("this is a sign-in, not a preview");
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Sign in as this person" })
    .click();

  await page.waitForURL(/\/en\/dashboard$/);
  // A student's shell: the Administration section is built from the session's own role, so its
  // absence is the session having genuinely changed rather than a page having been re-rendered.
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(nav.getByRole("heading", { name: "Administration" })).toHaveCount(0);
  await expect(nav.getByRole("heading", { name: "My studies" })).toHaveCount(0);

  // And core-api agrees, which is the half that is not this app's rendering.
  await page.goto("/en/users");
  await expect(main).toContainText("Forbidden");
});

test("is offered to nobody but a superadmin, and never on one's own profile", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/users");
  await openProfile(page, "admin@admin.com");
  const main = page.getByRole("main");
  // core-api would answer, but becoming oneself is not a thing anybody needs.
  await expect(main.getByRole("button", { name: "Sign in as this person" })).toHaveCount(0);

  await signIn(page, SUPERVISOR, "/en/users");
  await openProfile(page, "alice.student@seed.recodex.local");
  // `takeOver` is granted to `superadmin` alone, under an explicit `allow: false` safety net for
  // everybody else -- so a supervisor reading the same profile is offered nothing.
  await expect(main.getByRole("button", { name: "Sign in as this person" })).toHaveCount(0);
  await expect(main.getByRole("link", { name: "Edit this account" })).toHaveCount(0);
});

test("is not offered on an account that has been disabled", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/users?q=seed.filler.16@seed.recodex.local");
  const main = page.getByRole("main");
  const row = main.getByRole("row").filter({ hasText: "seed.filler.16@" });

  await row.getByRole("button", { name: "Disable" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Disable" }).click();
  await expect(row).toContainText("Disabled");

  await openProfile(page, "seed.filler.16@seed.recodex.local");
  // Not an ACL rule -- core-api would issue the token -- but a session refused at every turn is
  // not worth offering.
  await expect(main.getByRole("button", { name: "Sign in as this person" })).toHaveCount(0);
  await expect(main.getByRole("link", { name: "Edit this account" })).toBeVisible();

  await page.goto("/en/users?q=seed.filler.16@seed.recodex.local");
  await row.getByRole("button", { name: "Enable" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Enable" }).click();
  await expect(row.getByRole("button", { name: "Disable" })).toBeVisible();
});

test("a student is offered none of it", async ({ page }) => {
  await signIn(page, STUDENT, "/en/profile");
  const main = page.getByRole("main");
  // Their own profile: the one control here is the one S-022 built.
  await expect(main.getByRole("link", { name: "Edit my account" })).toBeVisible();
  await expect(main.getByRole("button", { name: "Sign in as this person" })).toHaveCount(0);
});
