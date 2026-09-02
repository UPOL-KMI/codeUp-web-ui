import { test, expect } from "@playwright/test";

/**
 * The front door (A-001), and the way in through somebody else's identity provider (A-007).
 *
 * **No sign-in anywhere in this file.** That is the point of both: `/` is the one page in the
 * product a visitor sees before they have an account, and the sign-in page's external-auth section
 * is decided by deployment configuration rather than by who is asking.
 */
test("tells a visitor what ReCodEx is, and which instance this is", async ({ page }) => {
  await page.goto("/en");
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { name: "ReCodEx", level: 1 })).toBeVisible();
  await expect(main.getByText("Practise programming")).toBeVisible();

  // The instance names itself from `/v1/instances`, which core-api grants to the unauthenticated
  // role -- the same read the registration form makes.
  await expect(main.getByText("Frankenstein University, Atlantida")).toBeVisible();

  // The quick-start sections, which are the legacy Home page's substance.
  for (const heading of ["Groups", "Exercises", "Assignments", "Solutions"]) {
    await expect(main.getByRole("heading", { name: heading, level: 3 })).toBeVisible();
  }

  await expect(main.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("carries the anonymous shell, landmark and language switch included", async ({ page }) => {
  await page.goto("/en");

  // It lived outside the `(anon)` route group until A-001 and so had neither -- the same gap
  // S-024 found on the other anonymous pages.
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Interface language" })).toBeVisible();

  await page.goto("/cs");
  await expect(page.getByRole("main").getByText("Procvičujte programování")).toBeVisible();
});

test("offers no external sign-in where no provider is configured", async ({ page }) => {
  await page.goto("/en/login");
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { name: "Sign in", level: 1 })).toBeVisible();
  // This deployment sets no EXTERNAL_AUTH_* at all (Q-004), and the control appears only when both
  // the URL and the service id are set -- the legacy app's own condition. Verified from the other
  // side by hand: with the three variables set, the button renders with exactly the configured URL.
  await expect(main.getByText("Your institution can sign you in instead.")).toHaveCount(0);
});

test("says so when the external provider hands back nothing usable", async ({ page }) => {
  // What the callback redirects to (F-019) when the token is missing or core-api refuses it. It is
  // the one half of the external flow this deployment can actually reach.
  await page.goto("/en/login?externalAuthError=1");
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
});
