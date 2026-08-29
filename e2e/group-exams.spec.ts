import { test, expect } from "@playwright/test";

import { STUDENT, SUPERADMIN } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * The group's exams tab (S-008).
 *
 * The scheduling test **creates and then cancels** a real exam rather than asserting against a
 * seeded one: an exam is a period of time, so a fixture would either be permanently over or
 * permanently about to start, and the states worth testing are the transitions. Cancelling it
 * again is what keeps this runnable twice in a row -- and leaves nothing behind, because core-api
 * records an exam only once a student locks into it.
 *
 * The finished exam with a lock record *is* seeded (`ensureFinishedExam`), for the opposite
 * reason: producing one here would mean locking a student in every run, and every run would leave
 * a row behind.
 */
const GROUP_TAB = "/en/groups";

async function openExamsTab(page: import("@playwright/test").Page, groupName: string) {
  await page.goto(GROUP_TAB);
  await page.getByRole("main").getByRole("link", { name: groupName, exact: true }).click();
  await expect(page).toHaveURL(/\/en\/groups\/[0-9a-f-]+/);
  await page.goto(`${page.url().split("?")[0]}?tab=exams`);
}

// The mutating test uses a different group from the two read-only ones below, so the three can
// run in parallel the way every other spec here does -- an exam is group-wide state, and two
// workers disagreeing about whether one is scheduled would be this suite's own doing.
test("schedules an exam, shows it as scheduled, and cancels it again", async ({ page }) => {
  const cookie = await loginAndGetCookie(SUPERADMIN);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await openExamsTab(page, "[seed] Large Lecture");

  const main = page.getByRole("main");
  // Self-healing: a run that failed between scheduling and cancelling would otherwise poison every
  // later run, and an exam scheduled two hours out is not something core-api forgets on its own.
  const leftover = main.getByRole("button", { name: "Cancel the exam" });
  if (await leftover.isVisible()) {
    await leftover.click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirm" }).click();
  }
  await expect(main.getByText("No exam is scheduled")).toBeVisible();

  await main.getByRole("button", { name: "Schedule an exam" }).click();
  const dialog = page.getByRole("dialog");
  // The form opens on a beginning two hours out and a two-hour exam, which is a valid period as
  // it stands -- this test is about the round trip, not about the picker.
  await expect(dialog.getByRole("radio", { name: /All visible/ })).toBeChecked();
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(main.getByText("An exam is scheduled")).toBeVisible();
  await expect(main.getByText("All visible (read-only)")).toBeVisible();

  await main.getByRole("button", { name: "Cancel the exam" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirm" }).click();
  await expect(main.getByText("No exam is scheduled")).toBeVisible();
});

test("lists a held exam and the lock records taken during it", async ({ page }) => {
  const cookie = await loginAndGetCookie(SUPERADMIN);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await openExamsTab(page, "[seed] Intro to Programming");

  const main = page.getByRole("main");
  const exams = main.locator("table").first();
  await expect(exams.locator("tbody tr").first()).toBeVisible();

  await exams.getByRole("link", { name: "Lock records" }).first().click();
  await expect(page).toHaveURL(/\?tab=exams&exam=\d+$/);
  await expect(main.getByRole("heading", { name: "Lock records" })).toBeVisible();
  await expect(main.getByText("Alice Student")).toBeVisible();
});

test("a student sees the exam tab's history but none of the teacher's controls", async ({
  page,
}) => {
  const cookie = await loginAndGetCookie(STUDENT);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await openExamsTab(page, "[seed] Intro to Programming");

  const main = page.getByRole("main");
  await expect(main.getByText("No exam is scheduled")).toBeVisible();
  await expect(main.getByRole("button", { name: "Schedule an exam" })).toHaveCount(0);
  // The history is theirs to read; who locked in during it is not (core-api's `viewExamLocks`).
  await expect(main.locator("table").first().locator("tbody tr").first()).toBeVisible();
  await expect(main.getByRole("link", { name: "Lock records" })).toHaveCount(0);
});
