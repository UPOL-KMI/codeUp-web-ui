import { test, expect } from "@playwright/test";

import { STUDENT, SUPERADMIN } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import { deleteE2eGroupInvitations, seededInvitationIds } from "./helpers/core-api";

/**
 * The page a group invitation link leads to (S-023), read as the seeded student.
 *
 * Four of the five states are asserted here; the fifth -- actually accepting -- is not, and the
 * omission is deliberate. Accepting enrols the account in a group, and **no screen in this app can
 * put that back**: leaving a group is a capability the legacy app has and this one does not yet
 * (backlog S-026), so the test would poison every later spec's idea of which groups Alice studies
 * in, exactly the way `group-exams.spec.ts` avoids by undoing what it does. The accept path is
 * verified by hand instead, and recorded in `docs/PROGRESS.md`.
 *
 * The invitation ids come from core-api rather than from a click, because an invitation link
 * genuinely arrives out of band -- see `helpers/core-api.ts`.
 */
let invitations: Map<string, string>;

test.beforeAll(async () => {
  invitations = await seededInvitationIds();
});

function invitationUrl(note: string): string {
  const id = invitations.get(note);
  if (!id) {
    throw new Error(
      `No seeded invitation noted '${note}' -- run \`pnpm seed\` against this stack.`,
    );
  }
  return `/en/accept-group-invitation/${id}`;
}

test.beforeEach(async ({ page }) => {
  const cookie = await loginAndGetCookie(STUDENT);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
});

test("offers to join, and says what accepting does", async ({ page }) => {
  await page.goto(invitationUrl("[seed] open invitation"));

  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "[seed] Large Lecture" })).toBeVisible();
  // The group is named in the breadcrumb too, which is the only thing an invitation uuid could
  // have been labelled by.
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText(
    "[seed] Large Lecture",
  );
  // Who runs the group and what the sender wrote -- the two things that tell a recipient whether
  // this link is the one they were expecting.
  await expect(main.getByText("Sasha Mentor")).toBeVisible();
  await expect(main.getByText("[seed] open invitation")).toBeVisible();
  await expect(main.getByText("Accepting enrols you as a student of this group.")).toBeVisible();
  await expect(main.getByRole("button", { name: "Accept and join the group" })).toBeEnabled();
});

test("says so, rather than offering a dead button, once the link has expired", async ({ page }) => {
  await page.goto(invitationUrl("[seed] expired invitation"));

  const main = page.getByRole("main");
  await expect(main.getByText("This invitation link has expired")).toBeVisible();
  await expect(main.getByRole("button", { name: "Accept and join the group" })).toHaveCount(0);
});

test("refuses an organizational group, and names that as the reason", async ({ page }) => {
  await page.goto(invitationUrl("[seed] invitation to an organizational group"));

  const main = page.getByRole("main");
  await expect(main.getByText("This group is organizational")).toBeVisible();
  await expect(main.getByRole("button", { name: "Accept and join the group" })).toHaveCount(0);
});

test("refuses an archived group, and names that as the reason", async ({ page }) => {
  await page.goto(invitationUrl("[seed] invitation to an archived group"));

  const main = page.getByRole("main");
  await expect(main.getByText("This group has been archived")).toBeVisible();
  await expect(main.getByRole("button", { name: "Accept and join the group" })).toHaveCount(0);
});

test("sends an existing member on to the group instead of asking them to join it", async ({
  page,
}) => {
  await page.goto(invitationUrl("[seed] invitation to a group already joined"));

  const main = page.getByRole("main");
  await expect(main.getByText("You already study in this group")).toBeVisible();
  await expect(main.getByRole("button", { name: "Accept and join the group" })).toHaveCount(0);
  await main.getByRole("link", { name: "Go to the assignments" }).click();
  await expect(page).toHaveURL(/\/en\/groups\/[0-9a-f-]+\?tab=assignments$/);
});

test("reads a link to an invitation that no longer exists as a missing page", async ({ page }) => {
  await page.goto("/en/accept-group-invitation/00000000-0000-4000-8000-000000000000");
  await expect(page.getByRole("main")).toContainText("Page not found");
});

/**
 * Minting, editing and revoking the links (T-018), from the group's Settings tab.
 *
 * Creates its own link and deletes it again, so it leaves nothing behind and runs twice in a row --
 * and so it never touches the five seeded fixtures the tests above depend on. The note it uses is
 * its own, which is also how it finds its own row again after each step.
 */
test.describe("managing the links", () => {
  const NOTE = "[e2e] a link this test made";
  const RENAMED = "[e2e] and then renamed";

  // A link left behind is offered to whoever next opens the group's settings, and the test below
  // deletes its own only if it gets that far. Through core-api rather than the screen, because the
  // run this exists for is the one where the page is what died (PF-014). Indiscriminate over the
  // `[e2e] ` prefix for the same reason `deleteE2eSystemMessages` is: a run that never reached its
  // teardown cannot say which links were its own.
  test.afterEach(async () => {
    await deleteE2eGroupInvitations();
  });

  test.beforeEach(async ({ page }) => {
    const cookie = await loginAndGetCookie(SUPERADMIN);
    await page.context().addCookies([{ ...cookie, url: baseURL }]);
  });

  test("creates a link, changes it, and deletes it again", async ({ page }) => {
    await page.goto("/en/groups");
    await page
      .getByRole("main")
      .getByRole("link", { name: "[seed] Large Lecture", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "[seed] Large Lecture", level: 1 }),
    ).toBeVisible();
    await page.goto(`${page.url().split("?")[0]}?tab=settings`);

    const section = page
      .getByRole("main")
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Invitation links" }) });
    await expect(section).toBeVisible();

    // No sweep here any more: the `afterEach` above leaves nothing to start from (PF-014).
    const before = await section.locator("li").count();

    // A date already gone is refused by the form itself, before core-api is asked.
    await section.getByLabel("Note for whoever opens the link").fill(NOTE);
    await section.getByLabel("Expires").fill("2020-01-01T09:00");
    await section.getByRole("button", { name: "Create the link" }).click();
    await expect(page.getByText("Check the dates and try again.", { exact: true })).toBeVisible();
    await expect(section.locator("li")).toHaveCount(before);

    // Empty means a link that never expires, which is core-api's own nullable `expireAt`.
    await section.getByLabel("Expires").fill("");
    await section.getByRole("button", { name: "Create the link" }).click();
    await expect(page.getByText("The link was created.", { exact: true })).toBeVisible();

    const row = section.locator("li").filter({ hasText: NOTE });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Never expires");
    // The link is shown in full: it is the thing being handed out, and it points at S-023's page.
    await expect(row.locator("code")).toContainText("/accept-group-invitation/");

    await row.getByRole("button", { name: "Edit" }).click();
    await row.getByLabel("Note for whoever opens the link").fill(RENAMED);
    await row.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("The link was changed.", { exact: true })).toBeVisible();
    await expect(section.locator("li").filter({ hasText: RENAMED })).toHaveCount(1);

    const renamed = section.locator("li").filter({ hasText: RENAMED });
    await renamed.getByRole("button", { name: "Delete" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(
      dialog.getByRole("heading", { name: "Delete this invitation link?" }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("The link was deleted.", { exact: true })).toBeVisible();
    await expect(section.locator("li")).toHaveCount(before);
  });
});
