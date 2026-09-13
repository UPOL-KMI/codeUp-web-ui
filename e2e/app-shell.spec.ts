import { test, expect } from "@playwright/test";

import { STUDENT, SUPERADMIN } from "./helpers/accounts";
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

test("offers a student only what a student may open", async ({ context, page }) => {
  // core-api grants `user.viewAll` from `supervisor` up and `exercise.viewAll` / `pipeline.viewAll`
  // from `supervisor-student` up, so all three of these links ended in the refusal page for a
  // student. Signed in over the top of the shared superadmin session this file's `beforeEach`
  // establishes -- the cookie is replaced, not added to.
  await context.clearCookies();
  const cookie = await loginAndGetCookie(STUDENT);
  await context.addCookies([{ ...cookie, url: baseURL }]);
  await page.goto("/en/dashboard");

  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(nav.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "All groups" })).toBeVisible();

  await expect(nav.getByRole("heading", { name: "Exercises" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Exercise catalog" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Pipelines" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Users" })).toHaveCount(0);
  // The section itself stays -- one's own profile is in it.
  await expect(nav.getByRole("heading", { name: "People" })).toBeVisible();
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

/**
 * G-025. Two properties beyond "it appears", both of which would regress silently: the code has to
 * encode the page **including its query string** (a filtered table is the interesting thing to put
 * on a room's phones), and it has to keep doing so after a client-side navigation, since the dialog
 * stays mounted once opened.
 */
test("encodes the current page as a QR code, and keeps up when the page changes", async ({
  page,
}) => {
  await page.goto("/en/exercises?q=sort");
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await nav.getByRole("button", { name: "QR code of this page" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "QR code of this page" })).toBeVisible();
  // The address is shown as text beside the code, which is what makes it assertable at all -- and
  // is there for the reader whose camera will not focus.
  await expect(dialog.getByText("/en/exercises?q=sort")).toBeVisible();

  // The quiet zone (DEC-127): 29 modules of QR plus 4 either side. Without the explicit
  // `marginSize` the library defaults to none and the viewBox would be 29 -- a code that scanners
  // struggle with, and a regression nothing else here would catch.
  const code = dialog.getByRole("img", {
    name: "QR code encoding the address of the current page",
  });
  const viewBox = await code.getAttribute("viewBox");
  const modules = Number(viewBox?.split(" ")[2]);
  expect(modules).toBeGreaterThanOrEqual(29 + 8);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // Navigate without a reload, so the dialog mounted above survives, and reopen it.
  await nav.getByRole("link", { name: "Pipelines" }).click();
  await expect(page).toHaveURL(/\/en\/pipelines$/);
  await nav.getByRole("button", { name: "QR code of this page" }).click();
  await expect(page.getByRole("dialog").getByText("/en/pipelines")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("q=sort")).toHaveCount(0);
});
