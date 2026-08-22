import { test, expect } from "@playwright/test";

import { STUDENT } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * The solution screen (S-015).
 *
 * **What this cannot cover, and why:** no solution on this machine has a real evaluation. The
 * vendored `isolate` sandbox needs cgroup v1 and Docker Desktop provides only v2 (DEC-031), so
 * every submission resolves to an infrastructure failure. The failure and pending paths below are
 * therefore verified against real data; the test-by-test table, the compilation-failure output and
 * the limit-exceeded badges are built from core-api's own view factories and have never been seen
 * with data. Re-run this on a cgroup v1 host before trusting them.
 */
test("shows what happened to a submitted solution", async ({ page, context }) => {
  const cookie = await loginAndGetCookie(STUDENT);
  await context.addCookies([{ ...cookie, url: baseURL }]);

  await page.goto("/en/dashboard");
  await page.getByRole("main").locator("tbody tr").first().getByRole("link").first().click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+$/);

  const attempt = page
    .getByRole("main")
    .getByRole("link", { name: /^Attempt \d+$/ })
    .first();
  await attempt.click();
  await expect(page).toHaveURL(/\/en\/solutions\/[0-9a-f-]+$/);

  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: /^Attempt \d+$/ })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Summary" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Evaluation" })).toBeVisible();
});

test("explains an infrastructure failure as not the reader's fault", async ({ page, context }) => {
  const cookie = await loginAndGetCookie(STUDENT);
  await context.addCookies([{ ...cookie, url: baseURL }]);

  await page.goto("/en/dashboard");
  await page.getByRole("main").locator("tbody tr").first().getByRole("link").first().click();
  await page
    .getByRole("main")
    .getByRole("link", { name: /^Attempt \d+$/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/en\/solutions\/[0-9a-f-]+$/);

  // Every seeded submission fails this way on a cgroup v2 host -- which makes it the one
  // evaluation state that can be tested here, and the one a student on this box actually sees.
  const main = page.getByRole("main");
  await expect(main.getByText("This solution could not be evaluated")).toBeVisible();
  await expect(main.getByText(/not something you did wrong/)).toBeVisible();
  await expect(main.getByText(/Isolate init error/)).toBeVisible();
});

test("links back to the assignment it belongs to", async ({ page, context }) => {
  const cookie = await loginAndGetCookie(STUDENT);
  await context.addCookies([{ ...cookie, url: baseURL }]);

  await page.goto("/en/dashboard");
  await page.getByRole("main").locator("tbody tr").first().getByRole("link").first().click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+$/);
  const assignmentUrl = page.url();
  await page
    .getByRole("main")
    .getByRole("link", { name: /^Attempt \d+$/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/en\/solutions\/[0-9a-f-]+$/);

  await page.getByRole("link", { name: "Back to the assignment" }).click();
  await expect(page).toHaveURL(assignmentUrl);
});
