import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERADMIN, SUPERVISOR, SUPERVISOR_STUDENT } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import { deleteUserByEmailIfPresent } from "./helpers/core-api";
import { cleanUpCreated } from "./helpers/created";

/**
 * The user directory (AD-001).
 *
 * Everything asserted about the list itself goes through **core-api** rather than through a table
 * rearranging itself in the browser: the search, the role filter, the ordering and the paging are
 * all query parameters. The seed provides enough accounts for that to mean something -- 31, so two
 * pages, across four roles.
 *
 * **Who sees this screen is a three-way split, and the middle case is the interesting one**: a
 * plain supervisor reads the whole directory, a `supervisor-student` is refused it outright
 * (`viewAll` is granted from `supervisor` up, and that role inherits only `viewList`), and a
 * student is refused too. Nothing in this app encodes that rule -- core-api answers 403 and F-030
 * renders it -- so this spec is where the rule is actually checked.
 *
 * The account actions mutate the instance, so the two that do run put back what they changed: the
 * disable test re-enables, and the create test deletes the account it made.
 *
 * **The created account's address is unique per run, and it has to be.** Deleting a user is a soft
 * delete that rewrites the address to `<address>@deleted.recodex` (core-api's `AnonymizationHelper`,
 * one fixed suffix), and that column is unique across soft-deleted rows too -- so an address that
 * has been deleted once can never be deleted again, and a second run with a fixed address would
 * leave the account behind. Found by this spec on its second run, reproduced straight against
 * core-api, and filed as Q-021.
 */
const probeEmail = () => `e2e.ad001.probe.${Date.now()}@seed.recodex.local`;

// Registered once for the file (PF-014). The test below deletes its own account -- that deletion is
// what it asserts -- so in the ordinary case this finds it already gone; it exists for the run that
// fails before getting there and would otherwise leave a live account named like a seeded student.
const trackUser = cleanUpCreated(deleteUserByEmailIfPresent);

async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

test("searches by name and by email, through core-api", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/users");
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();
  await expect(main.getByText(/^Showing 1–20 of \d+\.$/)).toBeVisible();

  // The address, which is what an administrator usually has in hand.
  await main.getByLabel("Search").fill("alice.student");
  await main.getByRole("button", { name: "Search" }).click();
  await expect(main.getByText("Showing 1–1 of 1.")).toBeVisible();
  await expect(main.getByRole("link", { name: "Alice Student" })).toBeVisible();

  // And the name, matched against the same one box.
  await main.getByLabel("Search").fill("Newcomer");
  await main.getByRole("button", { name: "Search" }).click();
  await expect(main.getByText("Showing 1–1 of 1.")).toBeVisible();
  await expect(main.getByRole("link", { name: "Nora Newcomer" })).toBeVisible();
});

test("narrows to chosen roles and pages through what matched", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/users");
  const main = page.getByRole("main");

  // Read before narrowing, because that is what narrowing is measured against.
  const everyone = Number(
    (await main.getByText(/^Showing 1–20 of \d+\.$/).innerText()).match(/of (\d+)/)![1],
  );

  await main.getByLabel("Supervisors", { exact: true }).check();
  await main.getByLabel("Administrators").check();
  await main.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/role=supervisor(&|$)/);
  await expect(page).toHaveURL(/role=superadmin/);

  // **Not "of 2" (PF-010).** How many supervisors and administrators a deployment has is instance
  // state; what this test is about is that choosing roles narrows the list. Asserted against the
  // unfiltered total, and against an account that must survive the filter.
  const narrowed = Number(
    (await main.getByText(/^Showing 1–\d+ of \d+\.$/).innerText()).match(/of (\d+)/)![1],
  );
  expect(narrowed).toBeGreaterThan(0);
  expect(narrowed).toBeLessThan(everyone);
  await expect(main.getByRole("link", { name: "Sam Supervisor" })).toBeVisible();

  // The whole directory is two pages, and the last one offers no next.
  await page.goto("/en/users");
  const total = Number(
    (await main.getByText(/^Showing 1–20 of \d+\.$/).innerText()).match(/of (\d+)/)![1],
  );
  expect(total).toBeGreaterThan(20);
  await main.getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL(/[?&]page=1$/);
  await expect(main.getByText(`Showing 21–${total} of ${total}.`)).toBeVisible();
  await expect(main.getByRole("link", { name: "Next" })).toHaveCount(0);
});

test("orders by a column core-api knows, in both directions", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/users?q=seed.filler");
  const main = page.getByRole("main");

  await main.getByRole("link", { name: "Email" }).click();
  await expect(page).toHaveURL(/sort=email/);
  const firstAscending = await main.getByRole("row").nth(1).innerText();
  expect(firstAscending).toContain("seed.filler.01@");

  // Clicking the column already sorted on reverses it rather than starting over.
  await main.getByRole("link", { name: "Email" }).click();
  await expect(page).toHaveURL(/dir=desc/);
  const firstDescending = await main.getByRole("row").nth(1).innerText();
  expect(firstDescending).toContain("seed.filler.25@");
});

test("disables an account and lets it back in", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/users?q=seed.filler.24");
  const main = page.getByRole("main");
  const row = main.getByRole("row").filter({ hasText: "[seed] Filler Student 24" });

  await row.getByRole("button", { name: "Disable" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Disable" }).click();
  await expect(row).toContainText("Disabled");

  await row.getByRole("button", { name: "Enable" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Enable" }).click();
  await expect(row.getByRole("button", { name: "Disable" })).toBeVisible();
  await expect(row).not.toContainText("Disabled");
});

test("never offers to disable the reader's own account", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/users?q=admin@admin.com");
  const main = page.getByRole("main");
  const row = main.getByRole("row").filter({ hasText: "Admin Admin" });

  // core-api refuses `setIsAllowed` on oneself outright, so a button here could only ever fail.
  await expect(row).toContainText("You");
  await expect(row.getByRole("button", { name: "Disable" })).toHaveCount(0);
  await expect(row.getByRole("button", { name: "Delete" })).toBeVisible();
});

test("asks about a name collision before creating, then creates and deletes", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/users");
  const main = page.getByRole("main");
  const email = trackUser(probeEmail())!;

  await main.getByRole("button", { name: "Create a user" }).click();
  const form = page.getByRole("dialog");
  await form.getByLabel("First name").fill("Alice");
  await form.getByLabel("Last name").fill("Student");
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password", { exact: true }).fill("RecodexSeed123!");
  await form.getByLabel("Password again").fill("RecodexSeed123!");
  await form.getByRole("button", { name: "Create", exact: true }).click();

  // core-api answers a 200 with the people it already knows by that name; it is a question.
  await expect(form.getByRole("alert")).toContainText("Alice Student");
  await form.getByRole("button", { name: "Create anyway" }).click();
  await expect(form).toHaveCount(0);

  await page.goto(`/en/users?q=${encodeURIComponent(email)}`);
  const row = main.getByRole("row").filter({ hasText: email });
  await expect(row).toContainText("Student");

  await row.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(main.getByText("Nobody matches those filters.")).toBeVisible();
});

test("is read-only for a supervisor, and refused below that", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/users");
  const main = page.getByRole("main");
  // `viewAll` is a supervisor's; nothing that changes an account is.
  await expect(main.getByText(/^Showing 1–20 of \d+\.$/)).toBeVisible();
  await expect(main.getByRole("button", { name: "Create a user" })).toHaveCount(0);
  await expect(main.getByRole("button", { name: "Delete" })).toHaveCount(0);
});

test("is not a supervisor-student's screen, nor a student's", async ({ page }) => {
  await signIn(page, SUPERVISOR_STUDENT, "/en/users");
  // The role inherits `viewList` from student and never gains `viewAll` -- core-api's own split,
  // and the reason this screen is not simply "teachers see it".
  await expect(page.getByRole("main")).toContainText("Forbidden");

  await signIn(page, STUDENT, "/en/users");
  await expect(page.getByRole("main")).toContainText("Forbidden");
});
