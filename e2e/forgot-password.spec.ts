import { test, expect } from "@playwright/test";

/**
 * Resetting a forgotten password (A-004, A-005).
 *
 * **No real reset token appears here**, and cannot: core-api signs them with a key only it holds,
 * refuses to issue one through `issue-restricted-token` ("Password change tokens can only be
 * issued through the password reset endpoint", verified live) and mails the only real one --
 * which this deployment cannot send (Q-007). So this spec covers everything up to the token and
 * everything the app does with a token core-api rejects; the success path was verified by hand
 * against a genuine minted token, on a filler account whose password was put back afterwards, and
 * that is recorded in `docs/PROGRESS.md`.
 */
test("asks for a link, and says the same thing either way", async ({ page }) => {
  await page.goto("/en/login");
  await page.getByRole("main").getByRole("link", { name: "I cannot remember my password" }).click();
  await expect(page).toHaveURL(/\/en\/forgot-password$/);

  const main = page.getByRole("main");
  await main.getByLabel("Email").fill("alice.student@seed.recodex.local");
  await main.getByRole("button", { name: "Send the link" }).click();
  await expect(main.getByText(/a message with the link is on its way/)).toBeVisible();

  // An address with no account here answers identically -- a reset form that says "no such user"
  // is an account-existence oracle for anybody with a list of addresses.
  await page.goto("/en/forgot-password");
  await main.getByLabel("Email").fill("nobody.at.all@seed.recodex.local");
  await main.getByRole("button", { name: "Send the link" }).click();
  await expect(main.getByText(/a message with the link is on its way/)).toBeVisible();
});

test("the address core-api's own emails point at forwards here", async ({ page }) => {
  // `WebappLinks.php` builds the link as "/forgotten-password/change?{token}" by default -- the
  // token *is* the query string, and this app's own route is spelled differently.
  await page.goto("/forgotten-password/change?eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.bm90LXJlYWw");
  await expect(page).toHaveURL(/\/en\/forgot-password\/change\?/);
  await expect(
    page.getByRole("main").getByRole("heading", { name: "Choose a new password" }),
  ).toBeVisible();
});

test("says so when the link carries no token at all", async ({ page }) => {
  await page.goto("/en/forgot-password/change");
  const main = page.getByRole("main");
  await expect(main.getByText(/This address carries no reset link/)).toBeVisible();
  await main.getByRole("link", { name: "Ask for a new link" }).click();
  await expect(page).toHaveURL(/\/en\/forgot-password$/);
});

test("refuses to submit a password core-api scores as too weak, or two that differ", async ({
  page,
}) => {
  await page.goto("/en/forgot-password/change?eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.bm90LXJlYWw");
  const main = page.getByRole("main");
  const submit = main.getByRole("button", { name: "Change the password" });

  // The score is core-api's own zxcvbn, asked for on a debounce.
  await main.getByLabel("New password", { exact: true }).fill("a");
  await expect(main.getByText("Too weak — choose a different one.")).toBeVisible();
  await expect(submit).toBeDisabled();

  await main.getByLabel("New password", { exact: true }).fill("correct horse battery staple");
  await expect(main.getByText("Very strong.")).toBeVisible();
  await main.getByLabel("New password again").fill("something else");
  await expect(main.getByText("The two passwords differ.")).toBeVisible();
  await expect(submit).toBeDisabled();
});

test("shows core-api's own answer when the link is not a valid one", async ({ page }) => {
  await page.goto("/en/forgot-password/change?eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.bm90LXJlYWw");
  const main = page.getByRole("main");

  await main.getByLabel("New password", { exact: true }).fill("correct horse battery staple");
  await main.getByLabel("New password again").fill("correct horse battery staple");
  await main.getByRole("button", { name: "Change the password" }).click();

  // Not a generic sentence: an unreadable signature and an expired link are different problems.
  await expect(main.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/en\/forgot-password\/change\?/);
});
