import { test, expect } from "@playwright/test";

import { STUDENT } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * The reader's own account (S-022), reached the way it is reached: from their own profile.
 *
 * Nothing here changes a password. That call invalidates every token the account holds -- the
 * seeded student would stop working for every other spec in this suite, and there is no way to
 * put it back. The form's own rule (the two new passwords must match) is asserted instead, which
 * is the part this app owns.
 */
test("edits a profile field and puts it back", async ({ page }) => {
  const cookie = await loginAndGetCookie(STUDENT);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);

  await page.goto("/en/profile");
  await page.getByRole("main").getByRole("link", { name: "Edit my account" }).click();
  await expect(page).toHaveURL(/\/en\/profile\/edit$/);

  const main = page.getByRole("main");
  const titles = main.getByLabel("Titles before the name");

  try {
    for (const value of ["Bc.", ""]) {
      await titles.fill(value);
      await main.getByRole("button", { name: "Save profile" }).click();
      await expect(page.getByText("The profile was saved.", { exact: true })).toBeVisible();
      await page.reload();
      await expect(main.getByLabel("Titles before the name")).toHaveValue(value);
    }
  } finally {
    // Failing between the two halves used to leave this student named "Bc. Alice Student", which
    // then broke `points-export.spec.ts` -- it looks that name up in a downloaded file. A failure
    // here should cost one red test, not two.
    await titles.fill("");
    await main.getByRole("button", { name: "Save profile" }).click();
  }
});

test("refuses a new password that was typed differently twice", async ({ page }) => {
  const cookie = await loginAndGetCookie(STUDENT);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto("/en/profile/edit");

  const main = page.getByRole("main");
  await expect(main.getByText("Changing your password signs you out everywhere")).toBeVisible();

  await main.getByLabel("New password", { exact: true }).fill("something-new-1");
  await main.getByLabel("New password again").fill("something-new-2");
  await main.getByRole("button", { name: "Change password" }).click();

  await expect(main.getByText("The two passwords differ.")).toBeVisible();
  // The session survives, because nothing was sent.
  await expect(page).toHaveURL(/\/en\/profile\/edit$/);
});

test("creates a calendar link and expires it again", async ({ page }) => {
  const cookie = await loginAndGetCookie(STUDENT);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto("/en/profile/edit");

  const main = page.getByRole("main");
  await main
    .getByRole("button", { name: /Create a?n?o?t?h?e?r? ?calendar link|Create another link/ })
    .click();
  await expect(page.getByText("The calendar link was created.", { exact: true })).toBeVisible();

  const link = main.getByText(/\/users\/ical\//).first();
  await expect(link).toBeVisible();

  await main.getByRole("button", { name: "Expire" }).first().click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirm" }).click();
  await expect(main.getByText("Expired").first()).toBeVisible();
});
