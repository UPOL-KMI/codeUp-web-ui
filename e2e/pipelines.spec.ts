import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERADMIN, SUPERVISOR } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * The instance's pipelines, read (T-013, T-014).
 *
 * Nothing here writes: the fifteen pipelines are the deployment's own, every exercise on it is
 * configured against them, and a spec that edited one would change what T-009's configuration
 * screen finds. Editing has its own spec against a pipeline it creates.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

test("lists the instance's pipelines and says what each one does", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/pipelines");
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { name: "Pipelines", level: 1 })).toBeVisible();
  // **Not a hardcoded total (PF-010).** How many pipelines a deployment has is instance state --
  // this read 15 on one instance and 9 on another -- and what the counter is here to show is that
  // the list is counted and fits on one page, not what the number happens to be.
  const counter = main.getByText(/^Showing 1–\d+ of \d+\.$/);
  await expect(counter).toBeVisible();
  const [shown, total] = (await counter.innerText())
    .match(/1–(\d+) of (\d+)/)!
    .slice(1)
    .map(Number);
  expect(shown).toBe(total);

  // The row leads with what the pipeline *does* -- the parameters T-009's editor reads to decide
  // which fields a test offers.
  const row = main.getByRole("row").filter({ hasText: "Python execution & evaluation [stdout]" });
  await expect(row.getByText("Takes an entry point")).toBeVisible();
  await expect(row.getByText("Compares standard output")).toBeVisible();

  // Searching is core-api's, so a narrowed view is an address.
  await main.getByLabel("Search").fill("Compilation");
  await main.getByRole("button", { name: "Apply" }).click();
  // A plain GET form, so every field is in the address -- including the empty ones.
  await expect(page).toHaveURL(/\/en\/pipelines\?q=Compilation/);
  await expect(main.getByRole("row").filter({ hasText: "GCC Compilation" })).toBeVisible();
  await expect(
    main.getByRole("row").filter({ hasText: "Python execution & evaluation [stdout]" }),
  ).toHaveCount(0);
});

test("draws a pipeline's structure and names what is wired to what", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/pipelines?q=Python+execution");
  const main = page.getByRole("main");

  await main.getByRole("link", { name: "Python execution & evaluation [stdout]" }).click();
  await expect(page).toHaveURL(/\/en\/pipelines\/[0-9a-f-]+$/);

  // The graph is server-rendered SVG: it is in the HTML, not fetched or laid out in the browser.
  const graph = main.locator("svg.pipeline-graph");
  await expect(graph).toBeVisible();
  await expect(graph.locator("g.pipeline-node")).toHaveCount(22);
  await expect(graph.locator('g.pipeline-node[data-name="judge"]')).toHaveCount(1);
  // An external reference -- the hole an exercise's configuration fills in -- is its own kind.
  await expect(graph.locator('g.pipeline-node[data-kind="reference"]').first()).toBeVisible();

  // What the picture cannot say: the tables.
  await expect(main.getByRole("heading", { name: "Boxes (12)" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Variables (19)" })).toBeVisible();
  await expect(main.getByText("Filled in by the exercise").first()).toBeVisible();

  // A pipeline is shared machinery, so the exercises configured against it are named.
  await expect(main.getByRole("heading", { name: "Exercises using it" })).toBeVisible();
  await expect(main.getByRole("link", { name: "[seed] Echo Greeting" })).toBeVisible();
});

test("a supervisor may read pipelines, and a student may not", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/pipelines");
  // core-api's `canViewAll` covers a supervisor -- which is why T-009's configuration editor can
  // read the catalogue without being an administrator's screen.
  await expect(page.getByRole("main").getByRole("heading", { name: "Pipelines" })).toBeVisible();

  await signIn(page, STUDENT, "/en/pipelines");
  await expect(page.getByRole("main")).toContainText("Forbidden");
});
