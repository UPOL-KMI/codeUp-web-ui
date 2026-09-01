import { test, expect } from "@playwright/test";

import { STUDENT } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import { seededInvitationIds } from "./helpers/core-api";

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
