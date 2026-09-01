import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * Confirming an email address (A-006).
 *
 * Every seeded account is unverified (nothing in the seed confirms an address, since this
 * deployment cannot send the message), so the dashboard's nudge is always there to look at. The
 * **success** path needs a real `email-verification` token, which only core-api can sign and only
 * an email can deliver -- it was verified by hand with a minted one, on a filler account, and that
 * is recorded in `docs/PROGRESS.md`.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

test("the dashboard says an address is unconfirmed, and offers to send the message again", async ({
  page,
}) => {
  await signIn(page, STUDENT, "/en/dashboard");
  const main = page.getByRole("main");

  await expect(main.getByText(/Your email address has not been confirmed yet/)).toBeVisible();
  // What it costs is stated plainly: nothing is withheld, the mail simply does not arrive.
  await expect(main.getByText(/silence rather than a locked account/)).toBeVisible();

  await main.getByRole("button", { name: "Send the message again" }).click();
  // This deployment has no working SMTP (Q-007), so what comes back is core-api's own refusal --
  // and the point of this assertion is that the reader is told, rather than left with a button
  // that seems to have done something.
  await expect(main.getByText("Email cannot be sent, please try it later.")).toBeVisible();
});

test("the confirmation link needs a token, and says so when it has none", async ({ page }) => {
  await page.goto("/en/email-verification");
  const main = page.getByRole("main");
  await expect(main.getByText(/This address carries no confirmation link/)).toBeVisible();
});

test("confirming is a click, not something a link scanner can do", async ({ page }) => {
  // core-api's own template is "/email-verification?{token}" -- the token is the query string.
  await page.goto("/en/email-verification?eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.bm90LXJlYWw");
  const main = page.getByRole("main");

  // Nothing has happened yet: an inbox scanner opening the link must not confirm anything.
  await expect(main.getByRole("button", { name: "Confirm the address" })).toBeVisible();
  await expect(main.getByText(/The address is confirmed/)).toHaveCount(0);

  await main.getByRole("button", { name: "Confirm the address" }).click();
  await expect(main.getByRole("alert")).toBeVisible();
});
