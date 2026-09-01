import { test, expect } from "@playwright/test";

import { SUPERVISOR } from "./helpers/accounts";

/**
 * Signing in (A-002) -- the one flow every other spec in this suite skips.
 *
 * `helpers/auth.ts` deliberately keeps calling the BFF route directly (core-api hashes passwords
 * with bcrypt, and doing that once per persona rather than once per test is what keeps this suite
 * fast). **This spec is the one that drives the real form**, so the thing every other test assumes
 * is checked somewhere.
 *
 * No cookie is injected here: each test gets a fresh context, so these run as a visitor.
 */
test("signs in through the form and lands on the dashboard", async ({ page }) => {
  await page.goto("/en/login");
  const main = page.getByRole("main");

  await main.getByLabel("Email").fill(SUPERVISOR.email);
  await main.getByLabel("Password").fill(SUPERVISOR.password);
  await main.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/en\/dashboard$/);
  await expect(main.getByRole("heading", { level: 1 })).toBeVisible();
});

test("returns to the page that asked for a session", async ({ page }) => {
  // What `proxy.ts` does to a visitor who asks for a page behind the session.
  await page.goto("/en/exercises");
  await expect(page).toHaveURL(/\/en\/login\?from=%2Fen%2Fexercises$/);

  const main = page.getByRole("main");
  await expect(
    main.getByText("That page is for signed-in users. Sign in and you will be taken there."),
  ).toBeVisible();

  await main.getByLabel("Email").fill(SUPERVISOR.email);
  await main.getByLabel("Password").fill(SUPERVISOR.password);
  await main.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/en\/exercises$/);
  await expect(main.getByRole("heading", { name: "Exercises", level: 1 })).toBeVisible();
});

test("will not be talked into leaving the app", async ({ page }) => {
  // A sign-in form that forwards the browser wherever a link says is a phishing tool: `from` is
  // only ever a path on this app.
  await page.goto("/en/login?from=https%3A%2F%2Fevil.example%2Fphish");

  const main = page.getByRole("main");
  await main.getByLabel("Email").fill(SUPERVISOR.email);
  await main.getByLabel("Password").fill(SUPERVISOR.password);
  await main.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/en\/dashboard$/);
});

test("says what went wrong, in core-api's own words", async ({ page }) => {
  await page.goto("/en/login");
  const main = page.getByRole("main");

  await main.getByLabel("Email").fill(SUPERVISOR.email);
  await main.getByLabel("Password").fill("definitely-not-the-password");
  await main.getByRole("button", { name: "Sign in" }).click();

  await expect(main.getByRole("alert")).toContainText("incorrect");
  // Still here, with the address kept so it can be corrected rather than retyped.
  await expect(page).toHaveURL(/\/en\/login$/);
  await expect(main.getByLabel("Email")).toHaveValue(SUPERVISOR.email);
});

test("explains a failed external sign-in rather than showing nothing", async ({ page }) => {
  // Where `app/api/auth/external/[authenticatorName]/callback` sends a token it could not use.
  await page.goto("/en/login?externalAuthError=1");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("external service");
});
