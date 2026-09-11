import { test, expect } from "@playwright/test";

import { SUPERADMIN } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import { SEEDED_GROUP_NAME } from "./helpers/core-api";

/**
 * The command palette (D-015). Authenticated: it searches real core-api data and is mounted inside
 * the session-gated app shell.
 */
test.beforeEach(async ({ context, page }) => {
  const cookie = await loginAndGetCookie(SUPERADMIN);
  await context.addCookies([{ ...cookie, url: baseURL }]);
  await page.goto("/en/dashboard");
  // The Ctrl-K listener lives in the sidebar, and since PF-002 the sidebar streams in behind the
  // page rather than arriving with it -- so the shortcut is not armed until it is on screen. That
  // is the trade that ticket accepted, and this is where it shows.
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
});

test("opens on Ctrl+K and closes on Escape", async ({ page }) => {
  await page.keyboard.press("Control+k");
  const input = page.getByPlaceholder("Search groups, exercises and people…");
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(input).toBeHidden();
});

test("asks for a longer query before searching", async ({ page }) => {
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Search groups, exercises and people…").fill("a");
  await expect(page.getByText("Type at least two characters.")).toBeVisible();
});

test("finds a real group and navigates to it", async ({ page }) => {
  // The seeded group rather than the instance root: it is a fixture this suite owns, where the
  // instance's name is whatever the operator called their university (plan 003).
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Search groups, exercises and people…").fill(SEEDED_GROUP_NAME);

  // `exact`, because the seed gives that group a subgroup whose name contains this one.
  const hit = page.getByRole("option", { name: SEEDED_GROUP_NAME, exact: true });
  await expect(hit).toBeVisible();
  await hit.click();
  await expect(page).toHaveURL(/\/en\/groups\//);
});
