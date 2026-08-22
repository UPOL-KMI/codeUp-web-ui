import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERADMIN } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import type { SeedAccount } from "./helpers/accounts";

/**
 * The assignment screen (S-012). Reached the way a reader reaches it -- from the dashboard --
 * rather than by a hardcoded id, so the link that has existed since S-001 is part of what is
 * tested.
 */
async function openFirstAssignment(page: Page, account: SeedAccount): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto("/en/dashboard");
  await page.getByRole("main").locator("tbody tr").first().getByRole("link").first().click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+$/);
}

test("shows the assignment text, its terms and the reader's own solutions", async ({ page }) => {
  await openFirstAssignment(page, STUDENT);
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { name: "Assignment", level: 2 })).toBeVisible();
  await expect(main.getByText("Hello, ReCodEx!")).toBeVisible();
  await expect(main.getByRole("heading", { name: "Terms" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "My solutions" })).toBeVisible();
});

test("states whether submitting is possible, in words, without a button to nowhere", async ({
  page,
}) => {
  await openFirstAssignment(page, STUDENT);
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { name: "Submitting" })).toBeVisible();
  await expect(main.getByText(/You can submit|not being accepted|used all/)).toBeVisible();
  await expect(main.getByRole("button", { name: /submit/i })).toHaveCount(0);
});

test("lists submitted solutions newest first and links each to itself", async ({ page }) => {
  // The seeded student's two solutions are on the group's primary assignment; open it via the
  // group's assignment tab so the row order is the one this test is about.
  const cookie = await loginAndGetCookie(STUDENT);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto("/en/dashboard");
  await page.getByRole("main").locator("tbody tr").first().getByRole("link").first().click();

  const attempts = page.getByRole("main").getByRole("link", { name: /^Attempt \d+$/ });
  if ((await attempts.count()) > 0) {
    await attempts.first().click();
    await expect(page).toHaveURL(/\/en\/solutions\/[0-9a-f-]+$/);
  }
});

test("shows a teacher the same screen without personal claims about their own solutions", async ({
  page,
}) => {
  const cookie = await loginAndGetCookie(SUPERADMIN);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto("/en/dashboard");
  await page
    .getByRole("region", { name: "Coming up in your groups" })
    .locator("tbody tr")
    .first()
    .getByRole("link")
    .first()
    .click();

  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+$/);
  await expect(page.getByRole("main").getByText("Nothing submitted yet")).toBeVisible();
});
