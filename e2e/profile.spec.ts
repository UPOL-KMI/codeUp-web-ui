import { test, expect } from "@playwright/test";

import { STUDENT, SUPERADMIN } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * The user profile (S-021), reached both ways it is reachable: from the group's roster, and from
 * the sidebar's "My profile" -- the same screen about oneself, rendered by the same component at
 * both routes rather than duplicated or redirected.
 */
test("shows a teacher who a student is and where they belong", async ({ page }) => {
  const cookie = await loginAndGetCookie(SUPERADMIN);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);

  await page.goto("/en/groups");
  await page
    .getByRole("main")
    .getByRole("link", { name: "[seed] Intro to Programming", exact: true })
    .click();
  await expect(page).toHaveURL(/\/en\/groups\/[0-9a-f-]+/);
  await page.goto(`${page.url().split("?")[0]}?tab=students`);

  const main = page.getByRole("main");
  // The roster, not T-006's points matrix below it -- every student is named in both.
  await main.getByRole("table").first().getByRole("link", { name: "Alice Student" }).click();
  await expect(page).toHaveURL(/\/en\/users\/[0-9a-f-]+$/);

  await expect(main.getByRole("heading", { name: "Alice Student" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Account" })).toBeVisible();
  await expect(main.getByText("alice.student@seed.recodex.local")).toBeVisible();
  await expect(main.getByRole("heading", { name: "Groups" })).toBeVisible();
  await expect(main.getByRole("link", { name: "[seed] Intro to Programming" })).toBeVisible();
});

test("shows a reader their own profile under 'my profile'", async ({ page }) => {
  const cookie = await loginAndGetCookie(STUDENT);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto("/en/dashboard");

  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "My profile" })
    .click();
  // The same screen as anyone else's profile, rendered at this route rather than redirected to
  // one under /users -- so the URL a reader bookmarks is the stable "my profile" one.
  await expect(page).toHaveURL(/\/en\/profile$/);

  const main = page.getByRole("main");
  await expect(main.getByText("This is you")).toBeVisible();
  await expect(main.getByText("alice.student@seed.recodex.local")).toBeVisible();
  await expect(main.getByRole("link", { name: "[seed] Intro to Programming" })).toBeVisible();
});
