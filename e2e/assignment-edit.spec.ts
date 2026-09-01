import { test, expect } from "@playwright/test";

import { STUDENT, SUPERADMIN } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * An assignment's settings (T-002).
 *
 * Every change here is put back before the test ends, so the seeded assignment every other spec
 * reads is the same afterwards -- the same discipline `group-exams.spec.ts` and
 * `group-membership.spec.ts` follow, and the reason this one edits the *attempt limit* rather than
 * a deadline: it is a single integer with no consequences for any other screen's assertions.
 */
async function openSeededAssignment(page: import("@playwright/test").Page) {
  await page.goto("/en/groups");
  await page
    .getByRole("main")
    .getByRole("link", { name: "[seed] Intro to Programming", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "[seed] Intro to Programming", level: 1 }),
  ).toBeVisible();
  await page.goto(`${page.url().split("?")[0]}?tab=assignments`);
  await page.getByRole("main").getByRole("link", { name: "[seed] Echo Greeting" }).first().click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+$/);
}

test("changes a setting and puts it back", async ({ page }) => {
  const cookie = await loginAndGetCookie(SUPERADMIN);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await openSeededAssignment(page);

  await page.getByRole("main").getByRole("link", { name: "Edit assignment" }).click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+\/edit$/);

  const main = page.getByRole("main");
  const attempts = main.getByLabel("Attempts allowed", { exact: true });
  const original = await attempts.inputValue();

  for (const value of [String(Number(original) + 1), original]) {
    await attempts.fill(value);
    await main.getByRole("button", { name: "Save the settings" }).click();
    // Saving lands back on the assignment, which is where a teacher wants to see the result.
    await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+$/);
    await expect(
      page.getByText("The assignment was updated.", { exact: true }).first(),
    ).toBeVisible();

    await page.getByRole("main").getByRole("link", { name: "Edit assignment" }).click();
    await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+\/edit$/);
    await expect(main.getByLabel("Attempts allowed", { exact: true })).toHaveValue(value);
  }
});

test("asks for a second deadline only when there is one, and refuses one before the first", async ({
  page,
}) => {
  const cookie = await loginAndGetCookie(SUPERADMIN);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await openSeededAssignment(page);
  await page.getByRole("main").getByRole("link", { name: "Edit assignment" }).click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+\/edit$/);

  const main = page.getByRole("main");
  const allowSecond = main.getByLabel("Allow a second deadline", { exact: true });

  // The seeded assignment has one, so the fields for it are present.
  await expect(allowSecond).toBeChecked();
  await expect(main.getByLabel("Second deadline", { exact: true })).toBeVisible();

  // Turning it off takes its fields away rather than leaving them to be filled in and ignored.
  await allowSecond.uncheck();
  await expect(main.getByLabel("Second deadline", { exact: true })).toHaveCount(0);
  await allowSecond.check();

  // A second deadline before the first is the mistake a person actually makes, and the form
  // answers it without a round trip.
  const first = await main.getByLabel("First deadline", { exact: true }).inputValue();
  await main.getByLabel("Second deadline", { exact: true }).fill("2020-01-01T09:00");
  await main.getByRole("button", { name: "Save the settings" }).click();
  await expect(main.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+\/edit$/);
  expect(await main.getByLabel("First deadline", { exact: true }).inputValue()).toBe(first);
});

test("is neither offered to a student nor readable by one", async ({ page }) => {
  const cookie = await loginAndGetCookie(STUDENT);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await openSeededAssignment(page);

  await expect(page.getByRole("main").getByRole("link", { name: "Edit assignment" })).toHaveCount(
    0,
  );

  await page.goto(`${page.url()}/edit`);
  await expect(page.getByRole("main")).toContainText("Forbidden");
});
