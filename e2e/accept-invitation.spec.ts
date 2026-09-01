import { test, expect } from "@playwright/test";

/**
 * The page an emailed ReCodEx invitation leads to (S-024) -- the only screen in the product that
 * creates an account, and the only one reached with no session at all.
 *
 * Every token below is **built here, with a signature that is not real**, and that is exactly what
 * the page's contract allows: it decodes the token for display and never verifies it, because only
 * core-api holds the key it was signed with (see DEC-085 and Q-018). So the three display states
 * are fully testable while the fourth -- actually submitting -- is not: core-api would reject a
 * token this suite is not able to sign. That last step is verified by hand against a real minted
 * token and recorded in `docs/PROGRESS.md`.
 *
 * No session is established anywhere in this file, which is also the assertion that the route is
 * genuinely public.
 */
function invitationToken(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ typ: "JWT", alg: "HS256" })}.${encode(payload)}.not-a-real-signature`;
}

function invitationFor(overrides: Record<string, unknown> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  return invitationToken({
    iid: "00000000-0000-4000-8000-000000000000",
    eml: "ivy.invited@example.test",
    iat: now,
    exp: now + 604800,
    usr: ["Bc.", "Ivy", "Invited", "PhD."],
    grp: ["00000000-0000-4000-8000-000000000001"],
    ...overrides,
  });
}

test("shows who was invited, and asks only for a password", async ({ page }) => {
  await page.goto(`/en/accept-invitation?${invitationFor()}`);

  const main = page.getByRole("main");
  await expect(main.getByText("Bc. Ivy Invited PhD.")).toBeVisible();
  await expect(main.getByText("ivy.invited@example.test")).toBeVisible();
  await expect(main.getByText("Accepting also enrols you in 1 group.")).toBeVisible();
  await expect(main.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(main.getByRole("button", { name: "Create the account and sign in" })).toBeEnabled();
  // The invited person's own details are stated, not offered for editing: core-api put them in
  // the token, and the only inputs on the page are the two passwords.
  await expect(main.locator("input")).toHaveCount(2);
  await expect(main.locator('input:not([type="password"])')).toHaveCount(0);
});

test("catches two different passwords before asking core-api", async ({ page }) => {
  await page.goto(`/en/accept-invitation?${invitationFor()}`);

  const main = page.getByRole("main");
  await main.getByLabel("Password", { exact: true }).fill("one-password");
  await main.getByLabel("Password again").fill("a-different-one");
  await main.getByRole("button", { name: "Create the account and sign in" }).click();

  await expect(main.getByRole("alert")).toHaveText("The two passwords do not match.");
});

test("offers no form once the invitation has expired", async ({ page }) => {
  const expiredAt = Math.floor(Date.now() / 1000) - 3600;
  await page.goto(`/en/accept-invitation?${invitationFor({ exp: expiredAt })}`);

  const main = page.getByRole("main");
  await expect(main.getByText("This invitation has expired")).toBeVisible();
  await expect(main.getByRole("button", { name: "Create the account and sign in" })).toHaveCount(0);
});

test("says a damaged link is damaged, rather than showing an empty form", async ({ page }) => {
  await page.goto("/en/accept-invitation?this-is-not-a-token");
  await expect(page.getByRole("main")).toContainText("This invitation link cannot be read");

  // The same page with no token at all -- someone who opened the bare URL out of curiosity.
  await page.goto("/en/accept-invitation");
  await expect(page.getByRole("main")).toContainText("This invitation link cannot be read");
});

test("is reachable with no session, and creates none by being looked at", async ({ page }) => {
  await page.goto(`/en/accept-invitation?${invitationFor()}`);
  await expect(page).toHaveURL(/\/en\/accept-invitation\?/);
  expect(await page.context().cookies()).toEqual([]);
});
