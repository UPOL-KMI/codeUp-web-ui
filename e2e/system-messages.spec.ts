import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERADMIN, SUPERVISOR } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { deleteE2eSystemMessages } from "./helpers/core-api";
import { baseURL } from "./helpers/base-url";

/**
 * Broadcasts, and the two halves of them (AD-007): the screen that writes one, and every other
 * screen that has to show it.
 *
 * **A live message is visible to every persona in the suite**, which is the whole point of a
 * broadcast and also the hazard: one left behind by a failed run puts a banner *inside* `<main>` on
 * every page, so every spec that reads `getByRole("main")` fails at once. That is not theoretical --
 * twenty-five orphans had accumulated before anybody counted them.
 *
 * So there are two layers, and the second is the one that matters. Each test still removes its own
 * message in a `finally`, which is the ordinary path and leaves nothing to sweep. But **a Playwright
 * timeout skips `finally`** -- the lesson PF-007 wrote down for exercises and this file had not
 * learned -- so an `afterEach` hook sweeps every `e2e `-prefixed message straight through core-api
 * as well. It needs no page, so it survives the failures that killed the `finally`.
 *
 * Messages are written with a window that has already opened -- a queued message proves nothing
 * about the shell.
 *
 * The reader's "seen up to" timestamp is per account and is left as found: the dismissal test uses
 * the **supervisor**, whose banner state no other spec looks at, rather than the student whose
 * dashboard several of them read.
 *
 * For the same reason nothing here asserts that the banner is *absent*. Three of these tests have a
 * live broadcast up for part of their run, and they run in parallel with each other -- the banner
 * is shared state, so each test may only assert about its own message.
 */
// Registered once for the file (PF-007's pattern). In the ordinary case every test has already
// removed its own message and this finds nothing to do; it exists for the run that dies before its
// `finally`, which is how twenty-five of them got there.
test.afterEach(async () => {
  await deleteE2eSystemMessages();
});

async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

/** Writes a message that is live from a minute ago, in English only. */
async function publish(page: Page, text: string): Promise<void> {
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Write a message" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Text (EN)").fill(text);

  const from = new Date(Date.now() - 60_000);
  const pad = (value: number) => String(value).padStart(2, "0");
  await dialog
    .getByLabel("Shown from")
    .fill(
      `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}T${pad(from.getHours())}:${pad(from.getMinutes())}`,
    );

  await dialog.getByRole("button", { name: "Publish" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(main.getByRole("row").filter({ hasText: text })).toContainText("Showing now");
}

async function removeMessage(page: Page, text: string): Promise<void> {
  await page.goto("/en/system-messages");
  const row = page.getByRole("main").getByRole("row").filter({ hasText: text });
  if ((await row.count()) === 0) return;
  await row.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(row).toHaveCount(0);
}

test("publishes a message and puts it above every page", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/system-messages");
  const text = `e2e broadcast ${Date.now()}`;

  try {
    await publish(page, text);

    // The other half: a broadcast nobody sees is not a broadcast. The shell renders it above the
    // page rather than behind a bell, so it is there on whatever the reader opens next.
    await page.goto("/en/dashboard");
    const banner = page.getByRole("complementary", { name: "System messages" });
    await expect(banner).toContainText(text);
    await page.goto("/en/exercises");
    await expect(banner).toContainText(text);
  } finally {
    await removeMessage(page, text);
  }

  // This message specifically, not "no banner": the other tests in this file publish their own
  // broadcasts and run in parallel, so the banner is shared state and asserting its absence is
  // asserting something no test owns.
  await page.goto("/en/dashboard");
  await expect(page.getByText(text)).toHaveCount(0);
});

test("reaches a student, because the role is a floor and not a target", async ({
  page,
  browser,
}) => {
  await signIn(page, SUPERADMIN, "/en/system-messages");
  const text = `e2e floor ${Date.now()}`;

  try {
    await publish(page, text);

    // Addressed to `student`, which core-api reads as "students and everybody above them".
    const context = await browser.newContext();
    const studentPage = await context.newPage();
    await signIn(studentPage, STUDENT, "/en/dashboard");
    await expect(studentPage.getByRole("complementary", { name: "System messages" })).toContainText(
      text,
    );
    await context.close();
  } finally {
    await removeMessage(page, text);
  }
});

test("marks everything on screen as read, and stays read", async ({ page, browser }) => {
  await signIn(page, SUPERADMIN, "/en/system-messages");
  const text = `e2e read ${Date.now()}`;

  try {
    await publish(page, text);

    const context = await browser.newContext();
    const reader = await context.newPage();
    await signIn(reader, SUPERVISOR, "/en/dashboard");
    const banner = reader.getByRole("complementary", { name: "System messages" });
    await expect(banner).toContainText(text);

    // core-api stores one "seen up to" timestamp rather than a flag per message, so dismissing
    // covers everything currently showing -- and survives a reload, because it is on the account
    // rather than in the browser.
    await banner.getByRole("button", { name: "Mark as read" }).click();
    await expect(banner).toHaveCount(0);
    await reader.goto("/en/dashboard");
    await expect(reader.getByRole("complementary", { name: "System messages" })).toHaveCount(0);
    await context.close();
  } finally {
    await removeMessage(page, text);
  }
});

test("refuses the editing screen to everyone but a superadmin", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/system-messages");
  const main = page.getByRole("main");
  // `notification.viewAll` is the superadmin's, even though `create` is granted from `supervisor`
  // up -- a capability with nowhere to reach it (DEC-115).
  await expect(main).toContainText("Forbidden");

  await signIn(page, STUDENT, "/en/system-messages");
  await expect(main).toContainText("Forbidden");
});
