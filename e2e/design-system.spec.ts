import { test, expect } from "@playwright/test";

/**
 * Regression net for the Design System components (D-003 through D-009), driven through
 * `/dev/design-system` -- the one page that renders all of them.
 *
 * This exists because every one of those tickets built a throwaway demo page, verified by hand,
 * and deleted it, leaving nothing behind that would notice a regression. D-013 made the showcase
 * permanent, which makes a single spec cover the lot.
 *
 * Deliberately **not logged in**: the showcase route is public (`proxy.ts`), so this suite needs
 * no seeded accounts and no bcrypt login round trip -- the thing `playwright.config.ts` had to
 * drop its worker count for. The upload section is the only part that needs a session, and it is
 * not exercised here for that reason.
 */
test.beforeEach(async ({ page }) => {
  await page.goto("/en/dev/design-system");
});

test("renders every component section", async ({ page }) => {
  for (const heading of [
    "Theme tokens",
    "Data table",
    "Form kit",
    "Dialogs",
    "Code viewer",
    "Evaluation results",
    "States",
    "Toasts",
    "Upload",
  ]) {
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
});

test("dialog closes on Escape and returns focus to its trigger", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "Open dialog" });
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("confirmation dialog focuses cancel and survives a backdrop click", async ({ page }) => {
  await page.getByRole("button", { name: "Open confirmation" }).click();
  const alert = page.getByRole("alertdialog");
  await expect(alert).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();

  // The property that makes AlertDialog the right primitive for a destructive action (DEC-054):
  // a stray click outside must not dismiss it.
  await page.mouse.click(5, 5);
  await expect(alert).toBeVisible();
  await page.keyboard.press("Escape");
});

test("toasts appear and can be dismissed", async ({ page }) => {
  await page.getByRole("button", { name: "Show error toast" }).click();

  // `exact: true`, and not scoped by `role="status"`: Radix renders a separate off-screen
  // announcer -- literally `<span role="status" aria-live="assertive">Notification Could not save
  // the group...</span>` -- alongside the visible toast. A role-scoped lookup lands on that copy,
  // which has no dismiss button in it, and a loose text match resolves to both elements.
  const message = page.getByText("Could not save the group", { exact: true });
  await expect(message).toBeVisible();
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(message).toBeHidden();
});

test("a failing panel is contained by its boundary and recovers on retry", async ({ page }) => {
  await page.getByRole("button", { name: "Break the panel below" }).click();
  await expect(page.getByText("Something went wrong")).toBeVisible();
  // Containment is the point: the rest of the page still works.
  await expect(page.getByRole("heading", { name: "Toasts", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Repair it, then use the retry button" }).click();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Something went wrong")).toBeHidden();
});

test("code is highlighted server-side and its lines are linkable", async ({ page, request }) => {
  // Server-side highlighting is the actual requirement (brief §4), so assert it on the raw HTML
  // rather than on the hydrated DOM, where a client-side highlighter would look identical.
  const html = await (await request.get("/en/dev/design-system")).text();
  expect(html).toContain('id="L1"');
  expect(html).toContain("--shiki-light");

  await page.goto("/en/dev/design-system#L5");
  const targeted = page.locator("#L5");
  const other = page.locator("#L6");
  // :target styling, not a class toggle -- compare the two rather than asserting a literal colour.
  const [targetedBg, otherBg] = await Promise.all([
    targeted.evaluate((el) => getComputedStyle(el).backgroundColor),
    other.evaluate((el) => getComputedStyle(el).backgroundColor),
  ]);
  expect(targetedBg).not.toBe(otherBg);
});

test("names an exit code the environment gives a meaning to", async ({ page }) => {
  // The only place this table can be seen at all: DEC-031's sandbox never runs, so no solution on
  // this deployment has ever carried a test result (G-004).
  const row = (test: string) =>
    page.getByRole("row").filter({ hasText: test }).locator("td").last();

  // A python3 wrapper's code, named; one nobody named, as the number it is.
  await expect(row("divides by zero")).toHaveText("Zero division error");
  await expect(row("returns a code nobody named")).toHaveText("42");

  // Killed rather than returning, and a test that never ran has nothing to report.
  await expect(row("killed by a signal")).toHaveText("Terminated by signal 11");
  await expect(row("never ran")).toBeEmpty();

  // The exercise decides which codes are a success, and says so when it is not zero.
  await expect(row("an exit code this exercise accepts")).toContainText("3");
  await expect(row("an exit code this exercise accepts")).toContainText(
    "This exercise treats other codes as a success too.",
  );
});

test("markdown keeps the legacy renderer's delimiter behaviour", async ({ page }) => {
  const markdown = page.locator('[data-slot="markdown"]');

  // The case that would corrupt real exercise texts: two prices must stay prose. Asserted here as
  // well as in the unit tests because this is the full pipeline, including the plugin ordering
  // that the unit tests cannot see.
  await expect(markdown).toContainText("worth $10 and $5 in bonus points");

  // Raw HTML is shown as written, never executed -- markdown-it's html:false behaviour.
  await expect(markdown).toContainText("<b>this</b>");
  await expect(markdown.locator("b")).toHaveCount(0);

  // A lone $$...$$ paragraph is display math, and fences are highlighted by Shiki server-side.
  await expect(markdown.locator(".katex-display")).toHaveCount(1);
  await expect(markdown.locator(".shiki")).toHaveCount(1);
});
