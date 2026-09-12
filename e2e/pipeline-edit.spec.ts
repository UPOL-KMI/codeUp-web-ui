import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { SUPERADMIN, SUPERVISOR } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import { deletePipelineIfPresent } from "./helpers/core-api";

/**
 * Editing a pipeline and its structure (T-015, T-016).
 *
 * Everything that writes happens to a **copy** this spec makes and deletes again. The instance's
 * fifteen pipelines are what every exercise on it is configured against; editing one would change
 * what T-009's configuration screen builds, and forking is exactly the escape the screen itself
 * recommends for that reason.
 *
 * **`openCopy` is the safety rail, and it exists because writing this spec broke a seeded
 * pipeline.** Forking navigates with `router.push`, which is asynchronous: a `fill()` issued
 * straight afterwards lands on whichever page is still on screen -- the original. So nothing here
 * touches a field until the address has actually changed to a *different* pipeline, and the helper
 * returns that id so the assertions can prove which one they are on.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

/**
 * Every copy a test makes, removed even when the test died before its own teardown -- otherwise a
 * failed run leaves the instance with two pipelines of one name and the next run's `.first()`
 * picks whichever.
 */
const copies: string[] = [];

test.afterEach(async () => {
  while (copies.length > 0) await deletePipelineIfPresent(copies.pop()!);
});

function pipelineIdOf(url: string): string {
  return /\/pipelines\/([0-9a-f-]+)/.exec(url)?.[1] ?? "";
}

/** Fork the pipeline being edited and wait until the browser is genuinely on the copy. */
async function openCopy(page: Page): Promise<string> {
  const main = page.getByRole("main");
  const original = pipelineIdOf(page.url());
  expect(original).not.toBe("");

  await main.getByRole("button", { name: "Make a copy" }).click();
  await expect(page.getByText("The copy was made.", { exact: true })).toBeVisible();
  await expect.poll(() => pipelineIdOf(page.url()), { timeout: 15_000 }).not.toBe(original);
  await expect(page).toHaveURL(/\/en\/pipelines\/[0-9a-f-]+\/edit$/);
  await expect(main.getByRole("heading", { name: "How it is wired" })).toBeVisible();

  const copy = pipelineIdOf(page.url());
  expect(copy).not.toBe(original);
  copies.push(copy);
  return copy;
}

async function deleteCopy(page: Page, copyId: string): Promise<void> {
  expect(pipelineIdOf(page.url())).toBe(copyId);
  await page.getByRole("main").getByRole("button", { name: "Delete this pipeline" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete it" }).click();
  await expect(page.getByText("The pipeline was deleted.", { exact: true })).toBeVisible();
}

test("copies a pipeline, rewires the copy, and deletes it again", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/pipelines?q=Python+execution");
  const main = page.getByRole("main");

  await main.getByRole("link", { name: "Python execution & evaluation [stdout]" }).first().click();
  await main.getByRole("link", { name: "Edit this pipeline" }).click();
  await expect(page).toHaveURL(/\/en\/pipelines\/[0-9a-f-]+\/edit$/);

  // A pipeline is shared machinery, and the screen says so before anything is touched.
  await expect(main.getByText("configured against this pipeline")).toBeVisible();

  const copyId = await openCopy(page);

  // Structure first, settings second, each followed by a reload. Both saves refresh the page --
  // the editor is keyed by the pipeline's version so that a save re-seeds it from core-api -- and
  // interleaving them would race that refresh against the next keystroke.
  const preview = main.locator("svg.pipeline-graph");
  await expect(preview).toBeVisible();
  const before = await preview.locator("g.pipeline-node").count();

  // The editor draws the graph from what is on screen, not from what is saved.
  await main.getByLabel("Kind of box").selectOption({ label: "Input File (file-in)" });
  await main.getByRole("button", { name: "Add the box" }).click();
  await expect(preview.locator("g.pipeline-node")).toHaveCount(before + 1);
  await expect(main.getByText("Connected to nothing:")).toBeVisible();

  // Two of core-api's rules are about the graph, and the editor checks both before saving rather
  // than letting a red banner explain them afterwards. Wiring the new box to a variable something
  // else already writes breaks the first.
  await main.getByLabel("file-in, port input").selectOption("expected-output");
  await expect(main.getByText("UPolníček will refuse this")).toBeVisible();
  await expect(main.getByText("is written by more than one port")).toBeVisible();
  await expect(main.getByRole("button", { name: "Save the structure" })).toBeDisabled();

  // A brand-new variable breaks the second: nothing reads it. A variable that is only *read* is
  // fine -- that is what an external reference is -- which is why `entry-point` below works.
  await main.getByRole("button", { name: "Add a variable" }).click();
  await main
    .getByLabel(/^Name of variable/)
    .last()
    .fill("e2e-extra");
  await main.getByLabel("file-in, port input").selectOption("e2e-extra");
  await expect(main.getByText("Nothing reads these variables:")).toBeVisible();
  await expect(main.getByRole("button", { name: "Save the structure" })).toBeDisabled();

  // Remove it and wire the new box to a variable that is read and not yet written.
  // The added variable is the last row of the variables table -- its name lives in an input's
  // value, which `hasText` cannot see.
  await main
    .getByRole("region", { name: "Variables" })
    .getByRole("row")
    .last()
    .getByRole("button", { name: "Remove" })
    .click();
  await main.getByLabel("file-in, port input").selectOption("entry-point");
  await expect(main.getByText("UPolníček will refuse this")).toHaveCount(0);

  await main.getByRole("button", { name: "Save the structure" }).click();
  await expect(page.getByText("The structure was saved.", { exact: true })).toBeVisible();

  await page.reload();
  await expect(main.getByLabel("file-in, port input")).toHaveValue("entry-point");

  // The parameters are the load-bearing field: T-009 reads them to build its form.
  const settings = main.getByRole("region", { name: "What it is" });
  await settings.getByLabel("Name", { exact: true }).fill("[e2e] Copied pipeline");
  await settings.getByRole("checkbox", { name: "It takes extra files" }).check();
  await settings.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();

  // Read both back from core-api rather than from the editors' own state.
  await page.reload();
  await expect(settings.getByLabel("Name", { exact: true })).toHaveValue("[e2e] Copied pipeline");
  await expect(settings.getByRole("checkbox", { name: "It takes extra files" })).toBeChecked();
  await expect(main.getByLabel("file-in, port input")).toHaveValue("entry-point");

  await deleteCopy(page, copyId);
  await expect(page).toHaveURL(/\/en\/pipelines$/);
});

test("renaming a variable rewires every port that named it", async ({ page }) => {
  await signIn(page, SUPERADMIN, "/en/pipelines?q=Compilation+source");
  const main = page.getByRole("main");

  await main.getByRole("link", { name: "Compilation source files pass-through" }).first().click();
  await main.getByRole("link", { name: "Edit this pipeline" }).click();
  const copyId = await openCopy(page);

  // A pipeline connects boxes by name matching, so a rename that did not rewire would leave the
  // port pointing at a variable that no longer exists -- and core-api would accept it.
  const port = main.getByLabel("outs, port output");
  await expect(port).toHaveValue("source-files");
  await main.getByLabel("Name of variable 1").fill("renamed-files");
  await expect(port).toHaveValue("renamed-files");
  // And the producing port followed too, or the variable would end up written by nobody.
  await expect(main.getByLabel("sources, port input")).toHaveValue("renamed-files");
  await expect(main.getByText("UPolníček will refuse this")).toHaveCount(0);

  await deleteCopy(page, copyId);
});

test("a reader who may not change a pipeline is not offered the screen", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/pipelines?q=Python+execution");
  const main = page.getByRole("main");
  await main.getByRole("link", { name: "Python execution & evaluation [stdout]" }).first().click();
  await expect(page).toHaveURL(/\/en\/pipelines\/[0-9a-f-]+$/);

  // core-api's hints decide. A supervisor may read the catalogue; whether they may edit the
  // instance's own pipelines is its rule, not this app's, so both outcomes are checked for
  // consistency rather than one of them being assumed.
  const offered = await main.getByRole("link", { name: "Edit this pipeline" }).count();
  const detailUrl = page.url();
  await page.goto(`${detailUrl}/edit`);
  if (offered === 0) {
    await expect(page.getByRole("main")).toContainText("Forbidden");
  } else {
    await expect(main.getByRole("heading", { name: "Edit pipeline", level: 1 })).toBeVisible();
  }
});

test("makes a new pipeline from the catalog, and offers that to nobody else", async ({ page }) => {
  // G-016: forking was the only route to a new pipeline, which is no route at all on an instance
  // whose list is empty.
  await signIn(page, SUPERVISOR, "/en/pipelines");
  await expect(page.getByRole("main").getByRole("button", { name: "New pipeline" })).toHaveCount(0);

  await signIn(page, SUPERADMIN, "/en/pipelines");
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "New pipeline" }).click();

  // It lands on the new pipeline's own editor, empty and already real (DEC-093's shape).
  await expect(page).toHaveURL(/\/en\/pipelines\/[0-9a-f-]+\/edit$/);
  const created = pipelineIdOf(page.url());
  expect(created).not.toBe("");
  copies.push(created);

  await expect(main.getByLabel("Name", { exact: true })).toHaveValue(/^Pipeline by /);
  await expect(main.getByRole("heading", { name: "How it is wired" })).toBeVisible();

  await deleteCopy(page, created);
});
