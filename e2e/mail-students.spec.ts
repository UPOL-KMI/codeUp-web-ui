import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERVISOR } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * Mailing the whole class (G-011).
 *
 * Asserted on the **`href`**, not on a click: following a `mailto:` hands the URL to whatever the
 * machine running the test uses for mail, which is neither reproducible nor the thing under test.
 * What this ticket is about is which addresses end up in the blind-copy field, and that is in the
 * attribute.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

async function openStudentsTab(page: Page): Promise<void> {
  await page.goto("/en/groups");
  await page
    .getByRole("main")
    .getByRole("link", { name: "[seed] Intro to Programming", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "[seed] Intro to Programming", level: 1 }),
  ).toBeVisible();
  await page.goto(`${page.url().split("?")[0]!}?tab=students`);
}

test("offers the class's addresses as a blind-copy mailto", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/dashboard");
  await openStudentsTab(page);

  const link = page.getByRole("main").getByRole("link", { name: /^Mail all \d+ students$/ });
  await expect(link).toBeVisible();

  const href = await link.getAttribute("href");
  expect(href).not.toBeNull();
  // Blind copy, and nothing else: an address in `to` would show every student the whole class.
  expect(href!.startsWith("mailto:?bcc=")).toBe(true);
  expect(href).not.toContain("to=");
  expect(decodeURIComponent(href!)).toContain(STUDENT.email);

  // The same addresses as plain text, which is what a teacher whose mail client truncated the
  // link -- or who wants a mailing list rather than one message -- actually needs.
  await page.getByRole("main").getByText("Show the addresses as text").click();
  await expect(
    page.getByRole("main").getByRole("textbox", { name: /Every disclosed address/ }),
  ).toHaveValue(new RegExp(STUDENT.email.replace(/[.@]/g, "\\$&")));
});

test("is offered to whoever teaches the group, not to its students", async ({ page }) => {
  await signIn(page, STUDENT, "/en/dashboard");
  await openStudentsTab(page);

  const main = page.getByRole("main");
  // The roster is there -- this group publishes its stats -- but `sendEmail` is granted on
  // `group.isSupervisorOrAdmin`, which a student of the group is not.
  await expect(main.getByRole("link", { name: "Submissions" }).first()).toBeVisible();
  await expect(main.getByRole("link", { name: /^Mail all/ })).toHaveCount(0);
  await expect(main.getByText("Show the addresses as text")).toHaveCount(0);
});
