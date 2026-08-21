import { test, expect } from "@playwright/test";

import { SUPERADMIN } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * The command palette (D-015). Authenticated: it searches real core-api data and is mounted inside
 * the session-gated app shell.
 */
test.beforeEach(async ({ context, page }) => {
  const cookie = await loginAndGetCookie(SUPERADMIN);
  await context.addCookies([{ ...cookie, url: baseURL }]);
  await page.goto("/en/dashboard");
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
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Search groups, exercises and people…").fill("Frankenstein");

  const hit = page.getByRole("option", { name: /Frankenstein/ });
  await expect(hit).toBeVisible();
  await hit.click();
  await expect(page).toHaveURL(/\/en\/groups\//);
});
