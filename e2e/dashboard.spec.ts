import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERADMIN, SUPERVISOR_STUDENT } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import type { SeedAccount } from "./helpers/accounts";

/**
 * The dashboard's student section (S-001).
 *
 * Every assertion here is about *which* rows appear and in what order, never about a specific
 * date or point total: the seed script sets deadlines relative to when it ran, so anything
 * hardcoded would rot the day someone re-seeds. Deadline ordering is checked by reading the
 * machine-readable `datetime` attributes the `DateTime` component emits and asserting they
 * ascend -- which is the actual product requirement (IA §4.1: "sorted by urgency"), stated
 * without depending on what the dates are.
 */
async function signIn(page: Page, account: SeedAccount): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto("/en/dashboard");
}

test.describe("as a student", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, STUDENT);
  });

  test("lists open assignments with their group, deadline and status", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Upcoming deadlines" })).toBeVisible();

    const rows = page.getByRole("table").locator("tbody tr");
    await expect(rows).not.toHaveCount(0);

    const firstRow = rows.first();
    await expect(firstRow.getByRole("link", { name: /Echo Greeting/ })).toBeVisible();
    await expect(firstRow.getByRole("link", { name: /Intro to Programming/ })).toBeVisible();
    await expect(
      firstRow.getByText(/Not submitted|Correct|Partly correct|Evaluating/),
    ).toBeVisible();
  });

  test("orders the deadlines by urgency, nearest first", async ({ page }) => {
    const timestamps = await page
      .getByRole("table")
      .locator("tbody tr td:nth-child(3) time:first-child")
      .evaluateAll((nodes) => nodes.map((node) => Date.parse(node.getAttribute("datetime") ?? "")));

    expect(timestamps.length).toBeGreaterThan(0);
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
    // Nothing already past its deadline belongs in this panel.
    expect(Math.min(...timestamps)).toBeGreaterThan(Date.now());
  });

  test("summarises points per group and links to the group", async ({ page }) => {
    const progress = page.getByRole("heading", { name: "My progress" });
    await expect(progress).toBeVisible();

    const bar = page.getByRole("progressbar").first();
    await expect(bar).toBeVisible();
    const gained = Number(await bar.getAttribute("aria-valuenow"));
    const max = Number(await bar.getAttribute("aria-valuemax"));
    expect(gained).toBeGreaterThanOrEqual(0);
    expect(max).toBeGreaterThan(0);
    expect(gained).toBeLessThanOrEqual(max);
  });

  test("opens the assignment behind a deadline row", async ({ page }) => {
    await page.getByRole("table").locator("tbody tr").first().getByRole("link").first().click();

    await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+$/);
    // The section crumb has no page of its own, so it is text rather than a dead link.
    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumb.getByText("Assignments")).toBeVisible();
    await expect(breadcrumb.getByRole("link", { name: "Assignments" })).toHaveCount(0);
  });
});

test("shows only the sections the viewer's memberships call for", async ({ page }) => {
  // The superadmin administers the seeded groups but studies in none of them, so the teaching
  // half appears and the student half does not -- IA §4.1's rule that the sections follow
  // per-group membership rather than the global role.
  await signIn(page, SUPERADMIN);

  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "My teaching" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Upcoming deadlines" })).toHaveCount(0);
});

test("shows both halves to someone who studies in one group and teaches another", async ({
  page,
}) => {
  await signIn(page, SUPERVISOR_STUDENT);

  // IA §4.1: "Both sections are visible simultaneously if applicable. No mode switch."
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Upcoming deadlines" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "My teaching" })).toBeVisible();
});
