import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERVISOR } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * Discussion threads (T-022) -- the legacy `comments` module, on the screens that had one.
 *
 * Every comment this spec writes is deleted again through the product. A thread belongs to the
 * thing being discussed and the seeded entities are shared by other specs, so anything left behind
 * would be there for good: there is no throwaway exercise to hang a discussion on that would also
 * prove a *teacher and a student* can see each other's words.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

/** An assignment of the group the supervisor teaches, reached the way they would reach one. */
async function openGroupAssignment(page: Page): Promise<string> {
  await page.goto("/en/groups");
  await page
    .getByRole("main")
    .getByRole("link", { name: "[seed] Intro to Programming", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "[seed] Intro to Programming", level: 1 }),
  ).toBeVisible();
  await page.goto(`${page.url().split("?")[0]}?tab=assignments`);
  await page.getByRole("main").locator("tbody tr").first().getByRole("link").first().click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+$/);
  return page.url();
}

test("a teacher and a student hold a discussion on an assignment", async ({ browser }) => {
  const teacher = await browser.newPage();
  const student = await browser.newPage();

  await signIn(teacher, SUPERVISOR, "/en/groups");
  const assignmentUrl = await openGroupAssignment(teacher);

  const teacherMain = teacher.getByRole("main");
  await expect(teacherMain.getByRole("heading", { name: "Discussion" })).toBeVisible();
  await expect(teacherMain.getByText("Nothing has been said here yet.")).toBeVisible();

  // What "public" means is spelled out on each screen rather than left to be discovered.
  await expect(
    teacherMain.getByText("the students this is assigned to and the group's teachers", {
      exact: false,
    }),
  ).toBeVisible();

  await teacherMain.getByLabel("Say something").fill("[e2e] Read the second paragraph carefully.");
  await teacherMain.getByRole("button", { name: "Post it" }).click();
  await expect(teacher.getByText("Posted.", { exact: true })).toBeVisible();
  await expect(teacherMain.getByText("[e2e] Read the second paragraph carefully.")).toBeVisible();

  // The student sees it on the same assignment, and can answer.
  await signIn(student, STUDENT, assignmentUrl);
  const studentMain = student.getByRole("main");
  await expect(studentMain.getByText("[e2e] Read the second paragraph carefully.")).toBeVisible();
  await studentMain.getByLabel("Say something").fill("[e2e] Thanks, that helped.");
  await studentMain.getByRole("button", { name: "Post it" }).click();
  await expect(student.getByText("Posted.", { exact: true })).toBeVisible();

  // A student may not moderate somebody else's comment -- the controls are only on their own.
  const teacherComment = studentMain.getByRole("listitem").filter({
    hasText: "[e2e] Read the second paragraph carefully.",
  });
  await expect(teacherComment.getByRole("button", { name: "Delete" })).toHaveCount(0);
  const ownComment = studentMain
    .getByRole("listitem")
    .filter({ hasText: "[e2e] Thanks, that helped." });
  await expect(ownComment.getByRole("button", { name: "Delete" })).toBeVisible();

  // Put both back, through the product. The teacher may delete either.
  await teacher.reload();
  await expect(teacherMain.getByText("[e2e] Thanks, that helped.")).toBeVisible();
  for (const text of ["[e2e] Thanks, that helped.", "[e2e] Read the second paragraph carefully."]) {
    await teacherMain
      .getByRole("listitem")
      .filter({ hasText: text })
      .getByRole("button", { name: "Delete" })
      .click();
    await teacher.getByRole("alertdialog").getByRole("button", { name: "Delete it" }).click();
    await expect(teacher.getByText("The comment was deleted.", { exact: true })).toBeVisible();
  }
  await expect(teacherMain.getByText("Nothing has been said here yet.")).toBeVisible();

  await teacher.close();
  await student.close();
});

test("a private comment is a note to oneself and nobody else has it", async ({ browser }) => {
  const teacher = await browser.newPage();
  const student = await browser.newPage();

  await signIn(teacher, SUPERVISOR, "/en/exercises?q=Echo");
  await teacher.getByRole("main").getByRole("link", { name: "[seed] Echo Greeting" }).click();
  const teacherMain = teacher.getByRole("main");

  await teacherMain.getByLabel("Say something").fill("[e2e] Rewrite this before next term.");
  await teacherMain.getByLabel("Keep this to myself").check();
  // The checkbox says what private means here, which is stronger than most people expect.
  await expect(
    teacherMain.getByText("UPolníček leaves a private comment out", { exact: false }),
  ).toBeVisible();
  await teacherMain.getByRole("button", { name: "Post it" }).click();
  await expect(teacher.getByText("Posted.", { exact: true })).toBeVisible();
  await expect(teacherMain.getByText("Only you").first()).toBeVisible();

  // Another teacher of the same exercise does not have it at all: core-api filters it out of
  // everybody else's copy of the thread, so this app never has to hide it.
  await signIn(student, STUDENT, "/en/exercises");
  await expect(student.getByRole("main")).toContainText("Forbidden");

  // Making it public and back again is the same one call, with the value wanted rather than a flip.
  await teacherMain.getByRole("button", { name: "Show to others" }).click();
  await expect(teacher.getByText("Others can see it now.", { exact: true })).toBeVisible();
  await expect(teacherMain.getByText("Only you")).toHaveCount(0);

  await teacherMain.getByRole("button", { name: "Delete" }).click();
  await teacher.getByRole("alertdialog").getByRole("button", { name: "Delete it" }).click();
  await expect(teacher.getByText("The comment was deleted.", { exact: true })).toBeVisible();
  await expect(teacherMain.getByText("Nothing has been said here yet.")).toBeVisible();

  await teacher.close();
  await student.close();
});
