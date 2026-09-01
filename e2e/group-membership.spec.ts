import { test, expect } from "@playwright/test";

import { STUDENT, SUPERADMIN } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * Putting yourself into a group and taking yourself out (S-026).
 *
 * Runs against the seeded `[seed] Open Enrolment` -- a public group with nobody in it, which
 * exists precisely because no other seeded group is joinable and the Join control was therefore
 * unreachable. The test joins and then leaves, so it leaves nothing behind and can run twice in a
 * row, the same discipline `group-exams.spec.ts` follows.
 *
 * Neither control is offered from a permission hint, because core-api publishes none for these two
 * actions -- see the group page's `ownMembershipAction` and DEC-090. What the test asserts is the
 * consequence: the control that appears matches the reader's actual standing, and acting on it
 * changes that standing.
 */
async function openGroup(page: import("@playwright/test").Page, name: string) {
  await page.goto("/en/groups");
  await page.getByRole("main").getByRole("link", { name, exact: true }).click();
  await expect(page).toHaveURL(/\/en\/groups\/[0-9a-f-]+/);
  // `toHaveURL` resolves on the client-side URL change, which can be well before the group's own
  // markup replaces the list's. Wait for the heading, or every assertion below races the render.
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
}

test("joins a public group and leaves it again", async ({ page }) => {
  const cookie = await loginAndGetCookie(STUDENT);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await openGroup(page, "[seed] Open Enrolment");

  const main = page.getByRole("main");
  const sidebar = page.getByRole("navigation", { name: "Primary navigation" });

  // Self-healing start: a run that died mid-test would otherwise leave the account enrolled and
  // every later run would begin from the wrong state. Leaving is exactly what this test verifies,
  // so doing it here costs nothing.
  const leaveButton = main.getByRole("button", { name: "Leave this group" });
  if (await leaveButton.isVisible()) {
    await leaveButton.click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("You have left the group.", { exact: true })).toBeVisible();
  }

  await expect(main.getByRole("button", { name: "Join this group" })).toBeVisible();
  // Not a member yet, so there is no standing to show and no assignments tab to open.
  await expect(main.getByRole("heading", { name: "My standing" })).toHaveCount(0);

  await main.getByRole("button", { name: "Join this group" }).click();
  await expect(page.getByText("You have joined the group.", { exact: true })).toBeVisible();

  // The membership is real, not just a swapped button: the sidebar lists it and the group now
  // reports the reader's own standing in it.
  await expect(sidebar.getByRole("link", { name: "[seed] Open Enrolment" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "My standing" })).toBeVisible();
  await expect(main.getByRole("button", { name: "Leave this group" })).toBeVisible();

  // Leaving confirms first -- it discards the reader's standing in the group.
  await main.getByRole("button", { name: "Leave this group" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("heading", { name: "Leave this group?" })).toBeVisible();
  await dialog.getByRole("button", { name: "Confirm" }).click();

  await expect(page.getByText("You have left the group.", { exact: true })).toBeVisible();
  await expect(main.getByRole("button", { name: "Join this group" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "My standing" })).toHaveCount(0);
});

test("offers leaving, not joining, in a course the reader already studies in", async ({ page }) => {
  const cookie = await loginAndGetCookie(STUDENT);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await openGroup(page, "[seed] Intro to Programming");

  const main = page.getByRole("main");
  await expect(main.getByRole("button", { name: "Leave this group" })).toBeVisible();
  await expect(main.getByRole("button", { name: "Join this group" })).toHaveCount(0);
});

test("offers a group's own staff no student membership in it", async ({ page }) => {
  // The superadmin administers every seeded group. core-api would let them enrol as a student
  // anyway, and the legacy screen hides the control for exactly this case: for the administrator
  // of a course, "join" is a misclick rather than an intention.
  const cookie = await loginAndGetCookie(SUPERADMIN);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await openGroup(page, "[seed] Open Enrolment");

  const main = page.getByRole("main");
  await expect(main.getByText("Public")).toBeVisible();
  await expect(main.getByRole("button", { name: "Join this group" })).toHaveCount(0);
  await expect(main.getByRole("button", { name: "Leave this group" })).toHaveCount(0);
});

test("offers neither control on an archived group", async ({ page }) => {
  // The superadmin sees every group, which is the only way to reach an archived one this account
  // is not a student of. Archived groups take no new students, and there is nobody in it to leave.
  const cookie = await loginAndGetCookie(SUPERADMIN);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto("/en/archive");
  await page
    .getByRole("main")
    .getByRole("link", { name: "[seed] Retired Course", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "[seed] Retired Course", level: 1 }),
  ).toBeVisible();

  const main = page.getByRole("main");
  await expect(main.getByRole("button", { name: "Join this group" })).toHaveCount(0);
  await expect(main.getByRole("button", { name: "Leave this group" })).toHaveCount(0);
});
