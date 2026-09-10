import { test, expect } from "@playwright/test";

import { SUPERADMIN } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * The app shell (D-014). Authenticated, unlike `design-system.spec.ts`: the sidebar's whole point
 * is that its contents depend on who is looking at it.
 */
test.beforeEach(async ({ context, page }) => {
  const cookie = await loginAndGetCookie(SUPERADMIN);
  await context.addCookies([{ ...cookie, url: baseURL }]);
  await page.goto("/en/dashboard");
});

test("renders the primary navigation with the sections the IA specifies", async ({ page }) => {
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(nav).toBeVisible();

  for (const section of ["Dashboard", "My groups", "Exercises", "People"]) {
    await expect(nav.getByRole("heading", { name: section })).toBeVisible();
  }
});

test("shows the admin section to a superadmin", async ({ page }) => {
  // Visibility only -- core-api still authorises every admin route itself. A hidden link is not
  // authorisation, and neither is a visible one.
  await expect(
    page.getByRole("navigation").getByRole("heading", { name: "Administration" }),
  ).toBeVisible();
});

test("marks the current page as active for assistive technology, not just visually", async ({
  page,
}) => {
  await expect(page.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");

  await page.getByRole("link", { name: "Exercise catalog" }).click();
  await expect(page).toHaveURL(/\/en\/exercises$/);
  await expect(page.getByRole("link", { name: "Exercise catalog" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("collapses to a disclosure menu at phone width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.reload();

  const toggle = page.getByRole("button", { name: "Menu" });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
});

test("offers the FAQ to a signed-in reader, not only to a visitor", async ({ page }) => {
  // G-031: the page is public and lives outside this shell, so the link sits with the language
  // switch at the foot of the sidebar rather than in one of the IA's sections.
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await nav.getByRole("link", { name: "FAQ", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/faq$/);
  await expect(page.getByRole("main")).toBeVisible();
});
