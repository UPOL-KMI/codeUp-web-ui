import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { SUPERVISOR } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * An exercise's own files, the links into them, its people and copying it (T-023).
 *
 * Everything here happens to an exercise this spec creates and deletes again -- attaching a file
 * to the seeded one would change what T-009's configuration spec finds in its selects. The upload
 * is the real chunked one (S-014's Route Handler), not a stub, because the point of this ticket is
 * that a real file becomes selectable on the configuration screen.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

async function createExercise(page: Page): Promise<string> {
  const main = page.getByRole("main");
  await main.getByLabel("New exercise in").selectOption({ label: "[seed] Intro to Programming" });
  await main.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/en\/exercises\/[0-9a-f-]+\/edit$/);
  return page.url();
}

async function deleteExercise(page: Page, editUrl: string): Promise<void> {
  await page.goto(editUrl);
  await page.getByRole("main").getByRole("button", { name: "Delete this exercise" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete this exercise" }).click();
  await expect(page.getByText("The exercise was deleted.", { exact: true })).toBeVisible();
}

test("attaches a file, links it into the text, and makes it configurable", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/exercises");
  const main = page.getByRole("main");
  const editUrl = await createExercise(page);

  await expect(main.getByText("No files are attached yet.")).toBeVisible();

  // The real chunked upload, then the association call that makes it the exercise's file.
  await page.setInputFiles('input[type="file"]', {
    name: "expected.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Hello, ReCodEx!\n"),
  });
  const attach = main.getByRole("button", { name: "Attach 1 file" });
  await expect(attach).toBeEnabled({ timeout: 30_000 });
  await attach.click();
  await expect(page.getByText("The files were attached.", { exact: true })).toBeVisible();
  await expect(main.getByText("expected.txt").first()).toBeVisible();

  // A named link, which is what makes %%key%% work in the exercise text.
  await main.getByLabel("File", { exact: true }).selectOption({ label: "expected.txt" });
  await main.getByLabel("Key", { exact: true }).fill("sample");
  await main.getByRole("button", { name: "Create the link" }).click();
  await expect(page.getByText("The link was created.", { exact: true })).toBeVisible();
  await expect(main.getByText("%%sample%%")).toBeVisible();
  await expect(main.getByText("Anybody").first()).toBeVisible();

  // The placeholder is resolved for display and left alone in the editor -- a form bound to the
  // resolved copy would save the substituted URL over the author's own placeholder.
  await main.getByLabel("Name").first().fill("[e2e] Linked exercise");
  await main.getByLabel("Text").first().fill("Download the [sample](%%sample%%).");
  await main.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("The settings were saved.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(main.getByLabel("Text").first()).toHaveValue("Download the [sample](%%sample%%).");

  await main.getByRole("link", { name: "Back to the exercise" }).click();
  const sample = main.getByRole("link", { name: "sample" });
  await expect(sample).toBeVisible();
  await expect(sample).toHaveAttribute("href", /\/uploaded-files\/link\/[0-9a-f-]+$/);

  // The whole reason this ticket was load-bearing: the configuration screen can now point at it.
  await main.getByRole("link", { name: "Tests and evaluation" }).click();
  await main.getByRole("button", { name: "Add a test" }).click();
  await main.getByRole("textbox", { name: "Name" }).fill("Test 1");
  await main.getByRole("button", { name: "Save tests" }).click();
  await main.getByRole("checkbox", { name: /Python 3/ }).check();
  await main.getByRole("button", { name: "Save languages" }).click();
  await expect(page.getByText("Languages saved.", { exact: true })).toBeVisible();
  await main
    .getByRole("combobox", { name: "Expected output" })
    .selectOption({ label: "expected.txt" });
  await main.getByRole("button", { name: "Save configuration" }).click();
  await expect(page.getByText("Configuration saved.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(main.getByRole("combobox", { name: "Expected output" })).toHaveValue("expected.txt");

  // Removing the file confirms, and says what it costs.
  await page.goto(editUrl);
  await main.getByRole("button", { name: "Remove", exact: true }).first().click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("that test will fail at evaluation time");
  await dialog.getByRole("button", { name: "Remove the file" }).click();
  await expect(page.getByText("The file was removed.", { exact: true })).toBeVisible();

  await deleteExercise(page, editUrl);
});

test("copies an exercise into another group, and the copy is its own", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/exercises");
  const main = page.getByRole("main");
  const editUrl = await createExercise(page);

  await main.getByLabel("Name").first().fill("[e2e] Original");
  await main.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("The settings were saved.", { exact: true })).toBeVisible();

  await main.getByLabel("Copy into").selectOption({ label: "[seed] Intro to Programming / Lab A" });
  await main.getByRole("button", { name: "Copy the exercise" }).click();
  await expect(page.getByText("The copy was made.", { exact: true })).toBeVisible();

  // The copy is a different exercise, and lands on its own settings.
  // The copy has its own id, so waiting for "the settings page of some exercise" would pass on
  // the page we are already on -- wait for the id to actually differ.
  await expect.poll(() => page.url(), { timeout: 15_000 }).not.toBe(editUrl);
  await expect(page).toHaveURL(/\/en\/exercises\/[0-9a-f-]+\/edit$/);
  const copyUrl = page.url();
  await expect(main.getByLabel("Name").first()).toHaveValue("[e2e] Original");

  // It says where it came from, which the detail screen already knew how to render.
  await main.getByRole("link", { name: "Back to the exercise" }).click();
  await expect(main.getByText("Forked from")).toBeVisible();

  await deleteExercise(page, copyUrl);
  await deleteExercise(page, editUrl);
});

test("names the author and offers administrators to whoever may set them", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/exercises");
  const main = page.getByRole("main");
  const editUrl = await createExercise(page);

  await expect(main.getByRole("heading", { name: "People and copies" })).toBeVisible();
  await expect(main.getByText("Sam Supervisor").first()).toBeVisible();
  await expect(main.getByText("Nobody besides the author.")).toBeVisible();

  // Somebody who teaches: core-api refuses a plain student as an exercise administrator, and
  // says so in its own words rather than this app pre-filtering who may be offered.
  await main.getByLabel("Name or email").fill("Sasha");
  await main.getByRole("button", { name: "Search", exact: true }).click();
  await main.getByRole("button", { name: "Make administrator" }).first().click();
  await expect(page.getByText("They can now change this exercise.", { exact: true })).toBeVisible();
  await expect(main.getByText("Nobody besides the author.")).toHaveCount(0);

  await main.getByRole("button", { name: "Remove", exact: true }).first().click();
  await expect(
    page.getByText("They can no longer change this exercise.", { exact: true }),
  ).toBeVisible();
  await expect(main.getByText("Nobody besides the author.")).toBeVisible();

  await deleteExercise(page, editUrl);
});
