import { test, expect } from "@playwright/test";

import { STUDENT, SUPERADMIN } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * Every test in this file edits **the same seeded assignment**, and every save core-api accepts
 * carries its optimistic lock and increments it -- so two of them running side by side refuse each
 * other with `400-010`. The config's `fullyParallel` would do exactly that; `mode: "default"` runs
 * this file's tests one after another instead. Found the hard way: G-007's two saving tests passed
 * the first time and raced on the next run, on an assignment already at version 147.
 */
test.describe.configure({ mode: "default" });

/**
 * An assignment's settings (T-002).
 *
 * Every change here is put back before the test ends, so the seeded assignment every other spec
 * reads is the same afterwards -- the same discipline `group-exams.spec.ts` and
 * `group-membership.spec.ts` follow, and the reason this one edits the *attempt limit* rather than
 * a deadline: it is a single integer with no consequences for any other screen's assertions.
 */
async function openSeededAssignment(page: import("@playwright/test").Page) {
  await page.goto("/en/groups");
  await page
    .getByRole("main")
    .getByRole("link", { name: "[seed] Intro to Programming", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "[seed] Intro to Programming", level: 1 }),
  ).toBeVisible();
  await page.goto(`${page.url().split("?")[0]}?tab=assignments`);
  await page.getByRole("main").getByRole("link", { name: "[seed] Echo Greeting" }).first().click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+$/);
}

test("changes a setting and puts it back", async ({ page }) => {
  const cookie = await loginAndGetCookie(SUPERADMIN);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await openSeededAssignment(page);

  await page.getByRole("main").getByRole("link", { name: "Edit assignment" }).click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+\/edit$/);

  const main = page.getByRole("main");
  const attempts = main.getByLabel("Attempts allowed", { exact: true });
  const original = await attempts.inputValue();

  for (const value of [String(Number(original) + 1), original]) {
    await attempts.fill(value);
    await main.getByRole("button", { name: "Save the settings" }).click();
    // Saving lands back on the assignment, which is where a teacher wants to see the result.
    await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+$/);
    await expect(
      page.getByText("The assignment was updated.", { exact: true }).first(),
    ).toBeVisible();

    await page.getByRole("main").getByRole("link", { name: "Edit assignment" }).click();
    await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+\/edit$/);
    await expect(main.getByLabel("Attempts allowed", { exact: true })).toHaveValue(value);
  }
});

test("asks for a second deadline only when there is one, and refuses one before the first", async ({
  page,
}) => {
  const cookie = await loginAndGetCookie(SUPERADMIN);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await openSeededAssignment(page);
  await page.getByRole("main").getByRole("link", { name: "Edit assignment" }).click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+\/edit$/);

  const main = page.getByRole("main");
  const allowSecond = main.getByLabel("Allow a second deadline", { exact: true });

  // The seeded assignment has one, so the fields for it are present.
  await expect(allowSecond).toBeChecked();
  await expect(main.getByLabel("Second deadline", { exact: true })).toBeVisible();

  // Turning it off takes its fields away rather than leaving them to be filled in and ignored.
  await allowSecond.uncheck();
  await expect(main.getByLabel("Second deadline", { exact: true })).toHaveCount(0);
  await allowSecond.check();

  // A second deadline before the first is the mistake a person actually makes, and the form
  // answers it without a round trip.
  const first = await main.getByLabel("First deadline", { exact: true }).inputValue();
  await main.getByLabel("Second deadline", { exact: true }).fill("2020-01-01T09:00");
  await main.getByRole("button", { name: "Save the settings" }).click();
  await expect(main.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+\/edit$/);
  expect(await main.getByLabel("First deadline", { exact: true }).inputValue()).toBe(first);
});

test("is neither offered to a student nor readable by one", async ({ page }) => {
  const cookie = await loginAndGetCookie(STUDENT);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await openSeededAssignment(page);

  await expect(page.getByRole("main").getByRole("link", { name: "Edit assignment" })).toHaveCount(
    0,
  );

  await page.goto(`${page.url()}/edit`);
  await expect(page.getByRole("main")).toContainText("Forbidden");
});

/**
 * The assignment's own text (G-007). Put back the way it was found, for the reason the file's
 * header gives -- `exercise-detail.spec.ts` reads the same sentence off the exercise it was copied
 * from, and a solution screen elsewhere reads the assignment's name.
 */
test("overrides the assignment's own text, and puts it back", async ({ page }) => {
  const cookie = await loginAndGetCookie(SUPERADMIN);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await openSeededAssignment(page);
  const assignmentUrl = page.url();

  await page.getByRole("main").getByRole("link", { name: "Edit assignment" }).click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+\/edit$/);

  const main = page.getByRole("main");
  // A fieldset per language, which is what tells the two "Name" fields apart.
  const english = main.getByRole("group", { name: "English", exact: true });
  const text = english.getByLabel("Text", { exact: true });
  const original = await text.inputValue();

  for (const value of [`${original} Then stop.`, original]) {
    await text.fill(value);
    await main.getByRole("button", { name: "Save the text" }).click();
    await expect(page.getByText("The text was saved.", { exact: true }).first()).toBeVisible();
    // It stays on the form rather than navigating: the settings form above it is holding the
    // version this save has just incremented, and the refresh is what hands it the new one.
    await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+\/edit$/);

    await page.goto(assignmentUrl);
    await expect(page.getByRole("main").getByText(value, { exact: false }).first()).toBeVisible();
    await page.getByRole("main").getByRole("link", { name: "Edit assignment" }).click();
    await expect(english.getByLabel("Text", { exact: true })).toHaveValue(value);
  }
});

test("saving the text does not make the settings form's version stale", async ({ page }) => {
  const cookie = await loginAndGetCookie(SUPERADMIN);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await openSeededAssignment(page);
  await page.getByRole("main").getByRole("link", { name: "Edit assignment" }).click();

  const main = page.getByRole("main");
  const english = main.getByRole("group", { name: "English", exact: true });
  const text = english.getByLabel("Text", { exact: true });
  const original = await text.inputValue();

  // Both saves carry the same optimistic lock and both increment it, so the second one on the
  // same screen is the case that would break -- core-api answers "edited in the meantime".
  await text.fill(`${original} `);
  await main.getByRole("button", { name: "Save the text" }).click();
  await expect(page.getByText("The text was saved.", { exact: true }).first()).toBeVisible();

  const attempts = main.getByLabel("Attempts allowed", { exact: true });
  const attemptsBefore = await attempts.inputValue();
  await main.getByRole("button", { name: "Save the settings" }).click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+$/);
  await expect(
    page.getByText("The assignment was updated.", { exact: true }).first(),
  ).toBeVisible();

  // Put the text back, and check the settings survived untouched.
  await page.getByRole("main").getByRole("link", { name: "Edit assignment" }).click();
  await expect(main.getByLabel("Attempts allowed", { exact: true })).toHaveValue(attemptsBefore);
  await english.getByLabel("Text", { exact: true }).fill(original);
  await main.getByRole("button", { name: "Save the text" }).click();
  await expect(page.getByText("The text was saved.", { exact: true }).first()).toBeVisible();
});

test("refuses a language that is named but says nothing, and one with no name at all", async ({
  page,
}) => {
  const cookie = await loginAndGetCookie(SUPERADMIN);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await openSeededAssignment(page);
  await page.getByRole("main").getByRole("link", { name: "Edit assignment" }).click();

  const main = page.getByRole("main");
  const english = main.getByRole("group", { name: "English", exact: true });
  const czech = main.getByRole("group", { name: "Czech", exact: true });
  const save = main.getByRole("button", { name: "Save the text" });

  // A name with nothing under it: the student would open an empty page.
  await czech.getByLabel("Name", { exact: true }).fill("Pozdrav");
  await save.click();
  await expect(
    czech.getByText("Fill in the text, or give an address where it can be read.", { exact: true }),
  ).toBeVisible();

  // An address instead of a text is enough -- but it has to be an address.
  await czech.getByLabel("External text", { exact: true }).fill("example.org/zadani");
  await save.click();
  await expect(
    czech.getByText("This has to be a full address, starting with http:// or https://.", {
      exact: true,
    }),
  ).toBeVisible();

  // And nothing named at all leaves the assignment unnameable.
  await czech.getByLabel("Name", { exact: true }).fill("");
  await czech.getByLabel("External text", { exact: true }).fill("");
  const englishName = await english.getByLabel("Name", { exact: true }).inputValue();
  await english.getByLabel("Name", { exact: true }).fill("");
  await save.click();
  await expect(
    main.getByText("The assignment needs a name in at least one language.", { exact: true }),
  ).toBeVisible();

  // Nothing was sent, so the assignment still has its name.
  await page.reload();
  await expect(english.getByLabel("Name", { exact: true })).toHaveValue(englishName);
});
