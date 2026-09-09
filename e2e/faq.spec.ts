import { test, expect } from "@playwright/test";

/**
 * The FAQ page (G-024), and the call to action that has been pointing at it since A-001.
 *
 * **No sign-in anywhere in this file**, deliberately: this is the one page a visitor is sent to
 * before they have an account, which is the whole reason P-001 ranked it above the teacher
 * controls. This deployment configures no `FAQ_URI`, so what these assertions read is the legacy
 * default -- the ReCodEx project's own wiki -- fetched server-side.
 */
test("answers with the configured document rather than a placeholder", async ({ page }) => {
  await page.goto("/en/faq");
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { name: "FAQ", level: 1 })).toBeVisible();
  await expect(main.getByText("This page hasn't been built yet.")).toHaveCount(0);

  // Markdown, not a wall of text: the document's own sections are headings, and its links are
  // links. Asserted structurally because the document belongs to the ReCodEx wiki, not to this
  // repo -- its wording is free to change, its shape is what this page promises to render.
  const markdown = main.locator('[data-slot="markdown"]');
  await expect(markdown).toBeVisible();
  expect(await markdown.getByRole("heading", { level: 2 }).count()).toBeGreaterThan(0);
  expect(await markdown.getByRole("link").count()).toBeGreaterThan(0);
});

test("is where the front door's second button goes", async ({ page }) => {
  // The defect P-001 filed: `/` offers this as one of its two calls to action, and what it
  // reached was "this page hasn't been built yet".
  await page.goto("/en");
  await page.getByRole("main").getByRole("link", { name: "Frequently asked questions" }).click();

  await expect(page).toHaveURL(/\/en\/faq$/);
  await expect(page.getByRole("main").locator('[data-slot="markdown"]')).toBeVisible();
});

test("reads in Czech too, with one document configured for both", async ({ page }) => {
  await page.goto("/cs/faq");
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { name: "FAQ", level: 1 })).toBeVisible();
  await expect(main.locator('[data-slot="markdown"]')).toBeVisible();
  // The failure notice is the other half of this page and it is not what a working deployment
  // shows; the wording it would use is asserted from the other side, by hand (PROGRESS.md).
  await expect(main.getByText("Obsah stránky FAQ se nepodařilo načíst")).toHaveCount(0);
});
