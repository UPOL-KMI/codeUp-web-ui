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

test("pairs two files whose names differ, on the reader's word, and undoes it", async ({
  page,
}) => {
  // G-030. The fixture is the seed's own: `[seed] zip archive` submits `solution.zip`, whose
  // entries core-api reports as `solution.zip#main.py`, so this pair of attempts shares no
  // filename at all -- which is the case the whole control exists for.
  const attempts = await seededAttemptsOfOneAuthor();
  const plain = attempts.find((row) => row.note.endsWith("correct"));
  const zipped = attempts.find((row) => row.note.endsWith("zip archive"));
  expect(plain, "the seed submits a plain solution").toBeDefined();
  expect(zipped, "the seed submits one solution as a ZIP (S-017)").toBeDefined();

  await signIn(page, SUPERADMIN, `/en/solutions/${plain!.id}/diff/${zipped!.id}`);
  const main = page.getByRole("main");

  // Nothing lines up by name, so the screen says so rather than guessing.
  await expect(main.getByRole("heading", { name: "No file appears in both" })).toBeVisible();
  const unpaired = main.getByRole("region", { name: "Files in only one of them" });
  // Scoped to the list rather than the section: the same names are also the select's options,
  // which are hidden until it is opened.
  const listed = (name: string) => unpaired.getByRole("listitem").filter({ hasText: name });
  await expect(listed("solution.py -- only in").first()).toBeVisible();
  await expect(listed("solution.zip#main.py").first()).toBeVisible();

  await unpaired
    .getByLabel("Compare solution.py with")
    .selectOption("solution.py::solution.zip#main.py");
  await unpaired.getByRole("button", { name: "Pair them" }).click();

  // The pairing is in the address, which is what makes a hand-made comparison a link.
  await expect(page).toHaveURL(/\?pair=solution\.py%3A%3Asolution\.zip%23main\.py$/);
  await expect(
    main.getByRole("heading", { name: "solution.py ↔ solution.zip#main.py" }),
  ).toBeVisible();
  // ...and the two really were compared: the ZIP entry's own first line is on screen.
  await expect(main.getByRole("table").getByText("from greeting import GREETING")).toBeVisible();
  await expect(main.getByText("paired by hand", { exact: false })).toBeVisible();

  // The other entry is still unpaired, and the file that was paired has left the list.
  const after = main.getByRole("region", { name: "Files in only one of them" });
  await expect(
    after.getByRole("listitem").filter({ hasText: "solution.zip#greeting.py" }).first(),
  ).toBeVisible();
  await expect(after.getByLabel("Compare solution.py with")).toHaveCount(0);

  await after.getByRole("link", { name: "undo" }).click();
  await expect(page).toHaveURL(new RegExp(`/en/solutions/${plain!.id}/diff/${zipped!.id}$`));
  await expect(main.getByRole("heading", { name: "No file appears in both" })).toBeVisible();
});

test("ignores a pairing in the address that names a file neither side has", async ({ page }) => {
  const attempts = await seededAttemptsOfOneAuthor();
  const [first, second] = attempts;
  await signIn(
    page,
    SUPERADMIN,
    `/en/solutions/${first!.id}/diff/${second!.id}?pair=gone.py%3A%3Aalso-gone.py`,
  );

  // A stale link is an ordinary thing to be sent, so the page falls back to pairing by name
  // rather than answering with an error.
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "solution.py" })).toBeVisible();
});
