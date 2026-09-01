import { test, expect } from "@playwright/test";

/**
 * Creating an account (A-003).
 *
 * **This deployment does not allow it** (`LOCAL_REGISTRATION_ENABLED=false` in the compose repo's
 * `.env`, and core-api publishes no way to ask), so what this suite can assert is the state this
 * instance is actually in: the page explains rather than offering a form, and the sign-in page
 * does not link to it. The form itself, its live "that address is taken" check and core-api's
 * refusal of a submission were verified by hand with `ALLOW_LOCAL_REGISTRATION=true`, and that is
 * recorded in `docs/PROGRESS.md`.
 */
test("says registration is not open here, rather than offering a form that would fail", async ({
  page,
}) => {
  await page.goto("/en/register");
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { name: "Create account", level: 1 })).toBeVisible();
  await expect(main.getByText(/does not let people create their own accounts/)).toBeVisible();
  await expect(main.getByRole("button", { name: "Create the account" })).toHaveCount(0);

  await main.getByRole("link", { name: "I already have an account" }).click();
  await expect(page).toHaveURL(/\/en\/login$/);
});

test("the sign-in page offers no link to it while it is closed", async ({ page }) => {
  await page.goto("/en/login");
  const main = page.getByRole("main");

  await expect(main.getByRole("link", { name: "I cannot remember my password" })).toBeVisible();
  // A link to a page that explains it cannot be done is a link nobody should be offered.
  await expect(main.getByRole("link", { name: "Create an account" })).toHaveCount(0);
});
