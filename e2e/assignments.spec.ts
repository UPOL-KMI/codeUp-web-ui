import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERADMIN, SUPERVISOR } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import { deleteSolutionIfPresent } from "./helpers/core-api";
import { cleanUpCreatedSolutions } from "./helpers/created-solutions";
import type { SeedAccount } from "./helpers/accounts";

/**
 * The assignment screen (S-012). Reached the way a reader reaches it -- from the dashboard --
 * rather than by a hardcoded id, so the link that has existed since S-001 is part of what is
 * tested.
 */
async function openFirstAssignment(page: Page, account: SeedAccount): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto("/en/dashboard");
  await page.getByRole("main").locator("tbody tr").first().getByRole("link").first().click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+$/);
}

test("shows the assignment text, its terms and the reader's own solutions", async ({ page }) => {
  await openFirstAssignment(page, STUDENT);
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { name: "Assignment", level: 2 })).toBeVisible();
  await expect(main.getByText("Hello, ReCodEx!")).toBeVisible();
  await expect(main.getByRole("heading", { name: "Terms" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "My solutions" })).toBeVisible();
});

test("states whether submitting is possible, in words, without a button to nowhere", async ({
  page,
}) => {
  await openFirstAssignment(page, STUDENT);
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { name: "Submitting" })).toBeVisible();
  await expect(main.getByText(/You can submit|not being accepted|used all/)).toBeVisible();
  await expect(main.getByRole("button", { name: /submit/i })).toHaveCount(0);
});

test("lists submitted solutions newest first and links each to itself", async ({ page }) => {
  // The seeded student's two solutions are on the group's primary assignment; open it via the
  // group's assignment tab so the row order is the one this test is about.
  const cookie = await loginAndGetCookie(STUDENT);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto("/en/dashboard");
  await page.getByRole("main").locator("tbody tr").first().getByRole("link").first().click();

  const attempts = page.getByRole("main").getByRole("link", { name: /^Attempt \d+$/ });
  if ((await attempts.count()) > 0) {
    await attempts.first().click();
    await expect(page).toHaveURL(/\/en\/solutions\/[0-9a-f-]+$/);
  }
});

/**
 * The teacher half of the same screen (S-013). Reached from the teacher's own dashboard, for the
 * same reason the student route is: the link is part of what is under test.
 */
async function openFirstAssignmentAsTeacher(page: Page, account: SeedAccount): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto("/en/dashboard");
  await page
    .getByRole("region", { name: "Coming up in your groups" })
    .locator("tbody tr")
    .first()
    .getByRole("link")
    .first()
    .click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+$/);
}

test("makes no personal claims to a teacher who does not study in the group", async ({ page }) => {
  await openFirstAssignmentAsTeacher(page, SUPERADMIN);
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { name: "Terms" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Submitting" })).toHaveCount(0);
  await expect(main.getByRole("heading", { name: "My solutions" })).toHaveCount(0);
});

test("shows a teacher how the group is doing, and every student's standing", async ({ page }) => {
  await openFirstAssignmentAsTeacher(page, SUPERVISOR);
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { name: "The group's progress" })).toBeVisible();
  await expect(main.getByText("Submitted", { exact: true })).toBeVisible();
  await expect(main.getByText("Average points")).toBeVisible();
  // Rows exist for students who have submitted nothing -- that is the half a teacher opens this
  // for -- so the roster is asserted by its own column header, not by a submission.
  await expect(main.getByRole("columnheader", { name: "Student" })).toBeVisible();
  await expect(main.getByText("Visible to students")).toBeVisible();
});

test("leads from a student's name to that student's own attempts", async ({ page }) => {
  await openFirstAssignmentAsTeacher(page, SUPERVISOR);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "The group's progress" })).toBeVisible();

  const student = main.locator("tbody tr").first().getByRole("link").first();
  const name = (await student.innerText()).trim();
  await student.click();

  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+\/users\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: `Solutions by ${name}` })).toBeVisible();
});

test("refuses one student a look at another student's attempts", async ({ page }) => {
  const cookie = await loginAndGetCookie(STUDENT);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto("/en/dashboard");
  await page.getByRole("main").locator("tbody tr").first().getByRole("link").first().click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+$/);

  const assignmentUrl = page.url();
  // Their own id -- the point is the route, not the target: a student holds no
  // `viewAssignmentSolutions` hint on the assignment, so the page is refused either way.
  await page.goto(`${assignmentUrl}/users/00000000-0000-0000-0000-000000000000`);
  await expect(page.getByText("You don't have permission to access this resource.")).toBeVisible();
});

const trackSolution = cleanUpCreatedSolutions();

test.describe("submitting a solution", () => {
  test("uploads a file, detects the language and creates a solution", async ({ page }) => {
    const cookie = await loginAndGetCookie(STUDENT);
    await page.context().addCookies([{ ...cookie, url: baseURL }]);
    await page.goto("/en/dashboard");
    await page.getByRole("main").locator("tbody tr").first().getByRole("link").first().click();
    await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+$/);

    await page.getByRole("link", { name: "Submit a solution" }).click();
    await expect(page).toHaveURL(/\/submit$/);

    // The real chunked upload path (D-005), not a stubbed one.
    await page.setInputFiles('input[type="file"]', {
      name: "solution.py",
      mimeType: "text/x-python",
      buffer: Buffer.from('print("Hello, ReCodEx!")\n'),
    });

    // core-api derives the offered environments from the file names, so the select only fills in
    // once the upload has finished and pre-submit has answered. `exact`, because A-008 added an
    // "Interface language" landmark and `getByLabel` matches by substring: two things on this page
    // are about a language, and only one of them is this field.
    const environment = page.getByLabel("Language", { exact: true });
    await expect(environment).toBeEnabled({ timeout: 30_000 });
    await expect(environment).toHaveValue("python3");

    await page.getByLabel("Note").fill("submitted by the e2e suite");
    await page.getByRole("button", { name: "Submit", exact: true }).click();

    // A successful submit lands on the new solution, carrying the monitor channel of the job it
    // just created (S-016) -- core-api discloses that id once, in the submit response, so if it
    // is not in this URL it is gone for good.
    await expect(page).toHaveURL(/\/en\/solutions\/[0-9a-f-]+\?monitor=[^&]+&tasks=\d+$/, {
      timeout: 30_000,
    });

    // Remembered here rather than only deleted below, because this test creates a real solution
    // and everything that counts Alice's attempts -- the solutions table, the dashboard, the
    // points matrix -- counts this one too. Left in, it made the suite pass once per seeded
    // database and fail on every run after. The delete stays inline: removing it is the ordinary
    // path, and the hook is for the run that never gets here (PF-011).
    const solutionId = trackSolution(page.url());
    if (solutionId !== null) await deleteSolutionIfPresent(solutionId);
  });

  test("refuses to submit before a file exists", async ({ page }) => {
    const cookie = await loginAndGetCookie(STUDENT);
    await page.context().addCookies([{ ...cookie, url: baseURL }]);
    await page.goto("/en/dashboard");
    await page.getByRole("main").locator("tbody tr").first().getByRole("link").first().click();
    await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+$/);
    await page.getByRole("link", { name: "Submit a solution" }).click();

    await expect(page.getByRole("button", { name: "Submit", exact: true })).toBeDisabled();
    await expect(page.getByLabel("Language", { exact: true })).toBeDisabled();
  });
});
