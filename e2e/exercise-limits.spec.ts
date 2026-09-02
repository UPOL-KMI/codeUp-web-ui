import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERVISOR } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * An exercise's resource limits (T-010).
 *
 * The seeded exercise is read, not written: its limits are what its reference solutions were
 * evaluated against. Everything that saves happens to an exercise this spec creates and deletes
 * again, the shape T-008 and T-009 both use.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

test("reads a configured exercise's limits without changing them", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/exercises?q=Echo");
  const main = page.getByRole("main");

  await main.getByRole("link", { name: "[seed] Echo Greeting" }).click();
  await main.getByRole("link", { name: "Execution limits" }).click();
  await expect(main.getByRole("heading", { name: "Execution limits", level: 1 })).toBeVisible();

  // The instance's one hardware group, chosen for this exercise, and its own grid.
  await expect(main.getByRole("checkbox", { name: /Default Group/ })).toBeChecked();
  await expect(
    main.getByRole("spinbutton", { name: "Memory for Test 1 in Python, in KiB" }),
  ).toHaveValue("65536");
  await expect(
    main.getByRole("spinbutton", { name: "Time for Test 1 in Python, in seconds" }),
  ).toHaveValue("5");

  // The seeded limits are wall-time, so the exercise is not measuring processor time.
  await expect(main.getByRole("checkbox", { name: "Measure processor time" })).not.toBeChecked();

  // The running total is what tells a reader a save will be refused for adding up.
  await expect(main.getByText("5 s of 300 s")).toBeVisible();
});

test("sets limits on a new exercise, and refuses ones the machine will not allow", async ({
  page,
}) => {
  await signIn(page, SUPERVISOR, "/en/exercises");
  const main = page.getByRole("main");

  await main.getByLabel("New exercise in").selectOption({ label: "[seed] Intro to Programming" });
  await main.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/en\/exercises\/[0-9a-f-]+\/edit$/);
  const editUrl = page.url();

  // A test and a language first -- limits are per test and per language, so there is nothing to
  // set until both exist, and the screen says so rather than showing an empty grid.
  await page.goto(editUrl.replace(/\/edit$/, "/edit-limits"));
  await expect(main.getByText("There is nothing to set limits for yet:")).toBeVisible();
  await expect(main.getByText("the exercise has no tests", { exact: true })).toBeVisible();
  await expect(main.getByText("no machine is selected", { exact: true })).toBeVisible();

  await page.goto(editUrl.replace(/\/edit$/, "/edit-config"));
  await main.getByRole("button", { name: "Add a test" }).click();
  await main.getByRole("textbox", { name: "Name" }).fill("Small input");
  await main.getByRole("button", { name: "Save tests" }).click();
  await expect(page.getByText("Tests saved.", { exact: true })).toBeVisible();
  await main.getByRole("checkbox", { name: /Python 3/ }).check();
  await main.getByRole("button", { name: "Save languages" }).click();
  await expect(page.getByText("Languages saved.", { exact: true })).toBeVisible();

  // The machine, which is core-api's @no-hwgroups and the last reason a new exercise is broken.
  await page.goto(editUrl.replace(/\/edit$/, "/edit-limits"));
  await main.getByRole("checkbox", { name: /Default Group/ }).check();
  await main.getByRole("button", { name: "Save machines" }).click();
  await expect(page.getByText("Machines saved.", { exact: true })).toBeVisible();

  const memory = main.getByRole("spinbutton", { name: "Memory for Small input in Python, in KiB" });
  const time = main.getByRole("spinbutton", { name: "Time for Small input in Python, in seconds" });
  await expect(memory).toBeVisible();

  // Out of range is caught before saving, and names the fields.
  await memory.fill("64");
  await expect(
    main.getByText(
      "Some limits are outside what this machine allows. The fields concerned are marked.",
    ),
  ).toBeVisible();
  await expect(main.getByRole("button", { name: "Save limits" })).toBeDisabled();

  await memory.fill("32768");
  await time.fill("3.5");
  await expect(main.getByText("3.5 s of 300 s")).toBeVisible();
  await main.getByRole("button", { name: "Save limits" }).click();
  await expect(page.getByText("Limits saved.", { exact: true })).toBeVisible();

  // Read back from core-api, not from the form's own state.
  await page.reload();
  await expect(memory).toHaveValue("32768");
  await expect(time).toHaveValue("3.5");

  // Switching the measure rewrites every limit into the other key, and the numbers survive it.
  await main.getByRole("checkbox", { name: "Measure processor time" }).check();
  await main.getByRole("button", { name: "Save limits" }).click();
  await expect(page.getByText("Limits saved.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(main.getByRole("checkbox", { name: "Measure processor time" })).toBeChecked();
  await expect(time).toHaveValue("3.5");

  // Nothing about hardware groups or limits is left in the exercise's own list of complaints.
  await page.goto(editUrl.replace(/\/edit$/, ""));
  await expect(main.getByText("No hardware group has been selected for it.")).toHaveCount(0);

  await page.goto(editUrl);
  await main.getByRole("button", { name: "Delete this exercise" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete this exercise" }).click();
  await expect(page.getByText("The exercise was deleted.", { exact: true })).toBeVisible();
});

test("is refused to a student", async ({ page }) => {
  await signIn(page, STUDENT, "/en/exercises");
  await expect(page.getByRole("main")).toContainText("Forbidden");
});
