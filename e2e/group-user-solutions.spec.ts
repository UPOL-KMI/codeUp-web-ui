import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERVISOR } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import { seededClassmateId } from "./helpers/core-api";

/**
 * One student's whole course, submission by submission (T-005).
 *
 * The property that makes this screen worth having -- and that no other screen in this app
 * shows -- is that the rows **span assignments**: the same person's attempts at everything in the
 * group, in one list. The seeded second student is the fixture for that (two submissions, two
 * different assignments), because he is the one nobody else's spec writes to.
 *
 * The review test writes on the instance and puts it back, the same discipline
 * `solution-sources.spec.ts` follows: it opens a review of its own on that student rather than
 * touching the three seeded ones, which the teacher dashboard's "reviews you have open" queue
 * depends on.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

async function openStudentsTab(page: Page): Promise<string> {
  await page.goto("/en/groups");
  await page
    .getByRole("main")
    .getByRole("link", { name: "[seed] Intro to Programming", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "[seed] Intro to Programming", level: 1 }),
  ).toBeVisible();
  const groupUrl = page.url().split("?")[0]!;
  await page.goto(`${groupUrl}?tab=students`);
  return groupUrl;
}

/** The roster's own link into the drill-down, for one named student. */
function rosterLink(page: Page, name: string) {
  return page
    .getByRole("main")
    .getByRole("table")
    .first()
    .getByRole("row")
    .filter({ hasText: name })
    .getByRole("link", { name: "Submissions" });
}

test("the roster leads to one student's submissions across the whole group", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/dashboard");
  await openStudentsTab(page);

  await rosterLink(page, "Alice Student").click();
  await expect(page).toHaveURL(/\/en\/groups\/[0-9a-f-]+\/users\/[0-9a-f-]+$/);

  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Alice Student", level: 1 })).toBeVisible();
  await expect(main.getByText(/submissions across \d+ assignments/)).toBeVisible();
  // The column that makes this list different from an assignment's own (T-003), which names the
  // author instead -- here every row is the same person.
  await expect(main.getByRole("columnheader", { name: "Assignment" })).toBeVisible();

  // The filter reads notes as well as assignment names, and lives in the URL like every other
  // table's (brief §9).
  await main.getByPlaceholder("Filter by assignment or note").fill("[seed] correct");
  await expect(main.getByRole("row").filter({ hasText: "e2e suite" })).toHaveCount(0);
  await expect(page).toHaveURL(/[?&]solutions-[0-9a-f]+-q=/);
});

test("shows one row per submission, spanning more than one assignment", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/dashboard");
  await openStudentsTab(page);
  await rosterLink(page, "Bob Classmate").click();

  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Bob Classmate", level: 1 })).toBeVisible();
  await expect(main.getByText("2 submissions across 2 assignments.")).toBeVisible();

  // Two rows, and the assignments they belong to are two different ones -- the seeded assignments
  // all share a name, so the identity has to come from where the column links.
  const assignments = await main.locator("tbody a[href*='/assignments/']").evaluateAll((links) => [
    // `/en/assignments/<id>` or `/en/assignments/<id>/solutions`, depending on what this reader
    // may open -- the id is the segment after the locale either way.
    ...new Set(links.map((link) => (link as HTMLAnchorElement).pathname.split("/")[3])),
  ]);
  expect(assignments).toHaveLength(2);
});

test("best solutions only is a filter in the URL, not a toggle in local storage", async ({
  page,
}) => {
  await signIn(page, SUPERVISOR, "/en/dashboard");
  await openStudentsTab(page);
  await rosterLink(page, "Alice Student").click();

  const main = page.getByRole("main");
  await main.getByRole("link", { name: "Best solutions only" }).click();
  await expect(page).toHaveURL(/[?&]filter=best$/);
  await expect(main.getByRole("link", { name: "Best solutions only" })).toHaveAttribute(
    "aria-current",
    "true",
  );

  // And the address alone reproduces it, which is the whole point of not keeping it in the browser.
  const shared = page.url();
  await page.goto(shared);
  await expect(main.getByRole("link", { name: "Best solutions only" })).toHaveAttribute(
    "aria-current",
    "true",
  );
});

test("a student reads their own submissions and is refused a classmate's", async ({ page }) => {
  await signIn(page, STUDENT, "/en/dashboard");
  await openStudentsTab(page);

  // Their own row is a link, the classmate's row is not: core-api's `viewStudentStats` is written
  // against the student as well as the group, so the offer is not the same for both rows.
  await expect(rosterLink(page, "Bob Classmate")).toHaveCount(0);
  await rosterLink(page, "Alice Student").click();
  await expect(
    page.getByRole("main").getByRole("heading", { name: "Alice Student", level: 1 }),
  ).toBeVisible();

  // A hidden link is not authorisation: typing the classmate's address is refused too. **Looked
  // up rather than written down** -- this line carried Bob's id from a database that has since
  // been re-seeded, so it was asking for somebody who no longer exists and getting "Page not
  // found", which is the right answer to the wrong question (PF-013).
  const own = page.url();
  const classmate = await seededClassmateId();
  await page.goto(own.replace(/\/users\/[0-9a-f-]+$/, `/users/${classmate}`));
  await expect(page.getByRole("main")).toContainText("Forbidden");
});

test("a person who does not study in the group is not a page", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/dashboard");
  const groupUrl = await openStudentsTab(page);

  await page.goto(`${groupUrl}/users/00000000-0000-0000-0000-000000000000`);
  await expect(page.getByRole("main")).toContainText("Page not found");
});

test("closes every open review on one student's work at once", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/dashboard");
  await openStudentsTab(page);
  await rosterLink(page, "Bob Classmate").click();
  // Waited for, not read straight after the click: a `Link` navigation is client-side, so
  // `page.url()` on the next line is still the page that was clicked *from*.
  await expect(page).toHaveURL(/\/en\/groups\/[0-9a-f-]+\/users\/[0-9a-f-]+$/);
  const drillDown = page.url();

  const main = page.getByRole("main");
  await expect(main.getByRole("button", { name: "Close open reviews" })).toHaveCount(0);

  // A review of this suite's own, on a student no other spec writes to -- the three seeded open
  // reviews belong to the dashboard's queue fixture and are left alone.
  const solution = await main
    .locator("tbody a[href*='/solutions/']")
    .first()
    .evaluate((link) => (link as HTMLAnchorElement).pathname);
  await page.goto(`${solution}/sources`);
  await page.getByRole("button", { name: "Start review" }).click();
  await expect(page.getByRole("button", { name: "Close review" })).toBeVisible();

  await page.goto(drillDown);
  await expect(main.getByText(/1 review is still open/)).toBeVisible();
  await main.getByRole("button", { name: "Close open reviews" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Close open reviews" }).click();
  // The toast lives outside `main` -- Radix portals it to the end of the document.
  await expect(page.getByText("1 review closed.", { exact: true })).toBeVisible();
  await expect(main.getByRole("button", { name: "Close open reviews" })).toHaveCount(0);

  // Put the student back the way the seed leaves him.
  await page.goto(`${solution}/sources`);
  await expect(page.getByRole("button", { name: "Reopen review" })).toBeVisible();
  await page.getByRole("button", { name: "Erase review" }).click();
  await page.getByRole("button", { name: "Erase review" }).last().click();
  await expect(page.getByRole("button", { name: "Start review" })).toBeVisible();
});
