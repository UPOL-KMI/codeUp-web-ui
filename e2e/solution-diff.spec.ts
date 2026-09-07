import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERADMIN } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import { seededAttemptsOfOneAuthor } from "./helpers/core-api";

/**
 * Comparing two attempts (G-005) -- the brief §7 landmine, named in three `INVENTORY.md` rows with
 * "keep capability" beside it and never built until now.
 *
 * **Reads only, and changes nothing.** The seed leaves one student with several attempts at one
 * assignment whose contents genuinely differ (`[seed] correct` prints the expected greeting,
 * `[seed] wrong` prints something else), so this whole spec runs against fixtures it does not have
 * to create or restore -- which is why there is no teardown here and no `serial`.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

test("lines up two attempts and marks what changed between them", async ({ page }) => {
  const [first, second] = await seededAttemptsOfOneAuthor();
  await signIn(page, SUPERADMIN, `/en/solutions/${first!.id}/diff/${second!.id}`);
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { name: "Comparing two attempts" })).toBeVisible();
  // The file the two share, lined up by name.
  await expect(main.getByRole("heading", { name: "solution.py" })).toBeVisible();

  // What actually differs: the seeded "correct" attempt prints the greeting, the "wrong" one does
  // not. Both lines are on screen, each on its own side.
  const table = main.getByRole("table");
  await expect(table.getByText('print("Hello, ReCodEx!")')).toBeVisible();
  await expect(table.getByText('print("Nope")')).toBeVisible();

  // ...and the change is stated in words, not only in colour -- a screen reader gets "added" and
  // "removed" from the cell, the tint is for everybody else.
  await expect(table.getByText("removed", { exact: true })).toBeVisible();
  await expect(table.getByText("added", { exact: true })).toBeVisible();
});

test("swaps which attempt is on which side", async ({ page }) => {
  const [first, second] = await seededAttemptsOfOneAuthor();
  await signIn(page, SUPERADMIN, `/en/solutions/${first!.id}/diff/${second!.id}`);

  await page.getByRole("link", { name: "Swap the sides" }).click();
  await expect(page).toHaveURL(new RegExp(`/solutions/${second!.id}/diff/${first!.id}$`));

  // The same comparison seen the other way round: what was removed is now added.
  const table = page.getByRole("main").getByRole("table");
  await expect(table.getByText('print("Hello, ReCodEx!")')).toBeVisible();
  await expect(table.getByText('print("Nope")')).toBeVisible();
});

test("is reached from the source viewer, which offers the author's other attempts", async ({
  page,
}) => {
  const [first] = await seededAttemptsOfOneAuthor();
  await signIn(page, SUPERADMIN, `/en/solutions/${first!.id}/sources`);
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { name: "Compare with another attempt" })).toBeVisible();
  await main
    .getByRole("link", { name: /^Attempt \d+$/ })
    .first()
    .click();

  await expect(page).toHaveURL(/\/en\/solutions\/[0-9a-f-]+\/diff\/[0-9a-f-]+$/);
  await expect(main.getByRole("heading", { name: "Comparing two attempts" })).toBeVisible();
});

test("names the files it could not line up rather than pairing them anyway", async ({ page }) => {
  const attempts = await seededAttemptsOfOneAuthor();
  // The archive attempt carries its files under a different name, so nothing pairs with it -- the
  // screen has to say which files each side has instead of comparing unrelated ones.
  const archive = attempts.find((a) => a.note.includes("archive"));
  test.skip(archive === undefined, "the seed has no archive attempt to compare against");

  await signIn(page, SUPERADMIN, `/en/solutions/${attempts[0]!.id}/diff/${archive!.id}`);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Files in only one of them" })).toBeVisible();
});

test("is not offered to a student on their own solution", async ({ page }) => {
  const [first] = await seededAttemptsOfOneAuthor();
  await signIn(page, STUDENT, `/en/solutions/${first!.id}/sources`);

  await expect(page.getByRole("heading", { name: "Compare with another attempt" })).toHaveCount(0);
});
