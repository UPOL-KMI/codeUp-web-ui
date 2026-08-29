import { test, expect } from "@playwright/test";

import { STUDENT, SUPERVISOR_STUDENT } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * What a reader is shown when core-api refuses (F-030). Both URLs here reached the reader as
 * "Something went wrong" before this ticket -- the error boundary, for two answers that are not
 * errors: a decision that went exactly right, and a thing that is not there.
 */
test("an entity this reader may not see renders the Forbidden page", async ({ page }) => {
  // The URL is found the way a reader would come by one -- from a teacher who can open it, whose
  // group this student is not in -- rather than hardcoded, since assignment ids are per-instance.
  const teacher = await loginAndGetCookie(SUPERVISOR_STUDENT);
  await page.context().addCookies([{ ...teacher, url: baseURL }]);
  await page.goto("/en/groups");
  await page.getByRole("main").getByRole("link", { name: "[seed] Large Lecture" }).click();
  await expect(page).toHaveURL(/\/en\/groups\/[0-9a-f-]+/);
  await page.goto(`${page.url().split("?")[0]}?tab=assignments`);
  await page.getByRole("main").locator("tbody tr").first().getByRole("link").first().click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+$/);
  const assignmentUrl = page.url();

  await page.context().clearCookies();
  const student = await loginAndGetCookie(STUDENT);
  await page.context().addCookies([{ ...student, url: baseURL }]);
  await page.goto(assignmentUrl);

  const main = page.getByRole("main");
  await expect(main.getByText("You don't have permission to access this resource.")).toBeVisible();
  await expect(main.getByText("Something went wrong")).toHaveCount(0);
});

test("an entity that does not exist renders the Not found page", async ({ page }) => {
  const cookie = await loginAndGetCookie(STUDENT);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto("/en/assignments/00000000-0000-0000-0000-000000000000");

  const main = page.getByRole("main");
  await expect(main.getByText("The page you're looking for doesn't exist.")).toBeVisible();
  await expect(main.getByText("Something went wrong")).toHaveCount(0);
});
