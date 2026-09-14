import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

import { STUDENT, SUPERVISOR } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import { seededAttemptsOfOneAuthor } from "./helpers/core-api";

/**
 * Five screens, both colour schemes, through axe-core's WCAG 2.x A/AA rules (X-009). The app has
 * carried landmarks, `aria-current` and a skip link since its first screens; nothing had ever
 * measured whether they add up. Only what axe calls serious or critical fails the test -- the
 * moderate findings are reported, not enforced, so a new rule in a new axe cannot turn the suite
 * red by itself.
 */
const ENFORCED = new Set(["serious", "critical"]);

async function audit(page: import("@playwright/test").Page, label: string) {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      // Next's own development overlay is not this app's markup.
      .exclude("nextjs-portal")
      .analyze();
    const enforced = results.violations.filter((v) => ENFORCED.has(v.impact ?? ""));
    const describe = (v: (typeof results.violations)[number]) =>
      `${v.id} (${v.impact}): ${v.help} -- ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(" "))
        .join(" | ")}`;
    const moderate = results.violations.filter((v) => !ENFORCED.has(v.impact ?? ""));
    if (moderate.length > 0) {
      console.log(
        `[axe] ${label} (${colorScheme}) moderate/minor:\n  ${moderate.map(describe).join("\n  ")}`,
      );
    }
    expect(enforced.map(describe), `${label} (${colorScheme})`).toEqual([]);
  }
}

test("the front door, the sign-in form and a guide", async ({ page }) => {
  for (const [path, label] of [
    ["/en", "landing"],
    ["/en/login", "login"],
    ["/en/docs/teacher", "guide"],
  ] as const) {
    await page.goto(path);
    await audit(page, label);
  }
});

test("a student's dashboard", async ({ page, context }) => {
  const cookie = await loginAndGetCookie(STUDENT);
  await context.addCookies([{ ...cookie, url: baseURL }]);
  await page.goto("/en/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await audit(page, "dashboard");
});

test("a solution, as the teacher who marks it", async ({ page, context }) => {
  const [first] = await seededAttemptsOfOneAuthor();
  const cookie = await loginAndGetCookie(SUPERVISOR);
  await context.addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(`/en/solutions/${first!.id}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await audit(page, "solution");
});
