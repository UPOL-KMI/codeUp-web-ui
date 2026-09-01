import { test, expect } from "@playwright/test";

import { SUPERVISOR } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * Reading the app in the other language (A-008).
 *
 * Two links rather than a control, because `localePrefix: "always"` means every page already has
 * one address per language -- so this asserts the addresses, the cookie that makes the choice
 * stick, and that switching keeps the reader on the page (and the filters) they were looking at.
 */
test("switches language without leaving the page or losing the query", async ({ page }) => {
  const cookie = await loginAndGetCookie(SUPERVISOR);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);

  await page.goto("/en/exercises?q=Merge");
  await expect(page.getByRole("main").getByRole("heading", { name: "Exercises" })).toBeVisible();

  await page.getByRole("link", { name: "Číst česky" }).click();
  await expect(page).toHaveURL(/\/cs\/exercises\?q=Merge$/);
  await expect(page.getByRole("main").getByRole("heading", { name: "Úlohy" })).toBeVisible();
  // Still the same narrowed view, not a trip back to an unfiltered page.
  await expect(
    page.getByRole("main").getByRole("link", { name: "[seed] Merge Sort" }),
  ).toBeVisible();

  // And the choice sticks: next-intl's own cookie is what `/` and the next visit read.
  const cookies = await page.context().cookies();
  expect(cookies.find((entry) => entry.name === "NEXT_LOCALE")?.value).toBe("cs");
});

test("a visitor can switch before signing in", async ({ page }) => {
  await page.goto("/en/login");
  await expect(page.getByRole("main").getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page.getByRole("link", { name: "Číst česky" }).click();
  await expect(page).toHaveURL(/\/cs\/login$/);
  await expect(page.getByRole("main").getByRole("heading", { name: "Přihlášení" })).toBeVisible();
});
