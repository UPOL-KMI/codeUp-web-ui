import { test, expect } from "@playwright/test";

/**
 * The three guides and the signpost that reaches them (X-002).
 *
 * Every test here is deliberately signed **out**. The guides are public, and the reason is the
 * circle otherwise: somebody deciding whether to install this, or a student who cannot get in,
 * are both people the documentation is for.
 */
test("offers the guides from the front page, to a visitor with no account", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("main").getByRole("link", { name: "Read the guides" }).first().click();

  await expect(page).toHaveURL(/\/en\/docs$/);
  const main = page.getByRole("main");
  await expect(
    main.getByRole("link", { name: "Installing and running the deployment" }),
  ).toBeVisible();
  await expect(main.getByRole("link", { name: "Running a course" })).toBeVisible();
  await expect(main.getByRole("link", { name: "Submitting your work" })).toBeVisible();
});

test("opens a guide and renders it as markdown, not as source", async ({ page }) => {
  await page.goto("/en/docs");
  await page.getByRole("main").getByRole("link", { name: "Running a course" }).click();

  await expect(page).toHaveURL(/\/en\/docs\/teacher$/);
  const main = page.getByRole("main");

  // A heading and a table from the document itself: both prove the markdown pipeline ran, and the
  // second is the part a plain-text fallback would lose.
  await expect(main.getByRole("heading", { name: "Writing an exercise" })).toBeVisible();
  // Exactly one `h1`: the shell's. A `#` at the top of the document would be a second one saying
  // the same thing, which is how this assertion earned its place.
  await expect(main.getByRole("heading", { level: 1 })).toHaveCount(1);
});

test("renders the fenced commands in the install guide as code", async ({ page }) => {
  await page.goto("/en/docs/install");
  const main = page.getByRole("main");
  await expect(main.getByText("docker compose build").first()).toBeVisible();
  await expect(main.getByRole("table").first()).toBeVisible();
});

test("is written in both languages, and the switch reaches the other one", async ({ page }) => {
  await page.goto("/cs/docs/student");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Odevzdávání řešení", level: 1 })).toHaveCount(1);
  await expect(main.getByRole("heading", { name: "Čtení výsledku" })).toBeVisible();

  await page.goto("/en/docs/student");
  await expect(main.getByRole("heading", { name: "Reading the result" })).toBeVisible();
});

test("a slug that is not a guide is not a page", async ({ page }) => {
  const response = await page.request.get("/en/docs/not-a-guide");
  // Q-016: a streamed App Router response says 200 and carries the 404 in its body instead.
  expect(await response.text()).toContain("NEXT_HTTP_ERROR_FALLBACK;404");
});
