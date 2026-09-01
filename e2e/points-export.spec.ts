import { readFileSync } from "node:fs";

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERVISOR } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * The points matrix as a file (T-007).
 *
 * Asserted on the **bytes**, not on a rendered table: the point of this ticket is a file that
 * opens correctly somewhere else, so what matters is the byte-order mark, the separator and the
 * columns -- none of which any screen would show.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

async function openStudentsTab(page: Page): Promise<void> {
  await page.goto("/en/groups");
  await page
    .getByRole("main")
    .getByRole("link", { name: "[seed] Intro to Programming", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "[seed] Intro to Programming", level: 1 }),
  ).toBeVisible();
  await page.goto(`${page.url().split("?")[0]!}?tab=students`);
}

test("downloads the group's points as a spreadsheet", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/dashboard");
  await openStudentsTab(page);

  const download = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("main").getByRole("link", { name: "Download as CSV" }).click(),
  ]).then(([event]) => event);

  // The group names the file, punctuation and all -- a teacher downloading three courses gets
  // three distinguishable files rather than three copies of `points.csv`.
  expect(download.suggestedFilename()).toBe("[seed] Intro to Programming.csv");

  const path = await download.path();
  const content = readFileSync(path, "utf8");
  // The BOM is what makes Excel read the file as UTF-8 rather than as the local code page.
  expect(content.startsWith("﻿")).toBe(true);

  const lines = content.slice(1).trimEnd().split("\r\n");
  const header = lines[0]!.split(";");
  expect(header.slice(0, 4)).toEqual(["Student", "Email", "Points", "Out of"]);
  // Shadow assignments are columns here even though the matrix on screen has none: their points
  // are inside every row's total, and a file whose columns do not add up to its own total is a
  // file somebody will spend an afternoon disbelieving.
  expect(header).toContain("[seed] Oral Exam");

  const alice = lines.find((line) => line.startsWith("Alice Student"))!;
  expect(alice).toContain("alice.student@seed.recodex.local");
  // Every row has a cell for every column, including the empty ones -- an assignment nothing was
  // submitted to is a blank field, not a missing one.
  expect(alice.split(";")).toHaveLength(header.length);
});

test("is offered to whoever teaches the group, not to its students", async ({ page }) => {
  await signIn(page, STUDENT, "/en/dashboard");
  await openStudentsTab(page);

  const main = page.getByRole("main");
  // The matrix itself is there -- this group publishes its stats -- but the export is the
  // teacher's affordance, the same rule the legacy results table applies.
  await expect(main.getByText("Points, assignment by assignment")).toBeVisible();
  await expect(main.getByRole("link", { name: "Download as CSV" })).toHaveCount(0);
});
