import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERADMIN, SUPERVISOR } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * The backend services this deployment runs on (AD-006).
 *
 * **Nothing here freezes the broker**, and that is deliberate rather than an oversight: freezing
 * stops evaluation for the whole deployment, and a test that died between freezing and unfreezing
 * would leave every later spec -- and the deployment itself -- silently swallowing submissions.
 * The control and its confirmation are asserted, and then cancelled. What *is* exercised end to
 * end is the ping, which is an empty job whose entire purpose is to be harmless.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

test("shows what the broker is doing, in core-api's own words", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/admin");
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { name: "Server", level: 1 })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Evaluation broker", level: 2 })).toBeVisible();
  // The stat names are core-api's flat map, rendered as given rather than renamed into a schema it
  // never promised.
  // Exact row headers: "worker-count" is also a substring of "idle-worker-count".
  await expect(main.getByRole("rowheader", { name: "worker-count", exact: true })).toBeVisible();
  await expect(main.getByRole("rowheader", { name: "queued-jobs", exact: true })).toBeVisible();
  await expect(main.getByText("The broker is handing evaluation jobs to workers")).toBeVisible();
});

test("offers only the freeze that applies, and says what it costs", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/admin");
  const main = page.getByRole("main");

  // `is-frozen` is in the stats, so the opposite action is never rendered.
  await expect(main.getByRole("button", { name: "Unfreeze the broker" })).toHaveCount(0);
  await main.getByRole("button", { name: "Freeze the broker" }).click();
  await expect(page.getByRole("alertdialog")).toContainText(
    "Evaluation stops for the whole deployment",
  );
  // Cancelled on purpose -- see this file's own note.
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});

test("tells a quiet queue from a dead one by pinging it", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/admin");
  const main = page.getByRole("main");

  await main.getByRole("button", { name: "Ping the handler" }).click();
  await main.getByRole("button", { name: "Refresh" }).last().click();

  // The ping is an ordinary async job and comes back finished on a live deployment, which is the
  // whole of what it is for.
  const row = main.getByRole("row").filter({ hasText: "ping" }).first();
  await expect(row).toBeVisible();
  await expect(row).toContainText("Done");
});

test("is the superadmin's screen and nobody else's", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/admin");
  const main = page.getByRole("main");
  // `permissions.neon` has no `resource: broker` rule at all, so the stats are refused to everyone
  // but a superadmin -- verified against core-api, which answers 403.
  await expect(main).toContainText("Forbidden");

  await signIn(page, STUDENT, "/en/admin");
  await expect(main).toContainText("Forbidden");
});
