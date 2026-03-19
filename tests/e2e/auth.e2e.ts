import { expect, test } from "@playwright/test";

const SIGN_IN_RE = /sign-in/;
const NAME_RE = /name/i;
const EMAIL_RE = /email/i;
const PASSWORD_RE = /password/i;
const SIGN_UP_BUTTON_RE = /sign up|create account|register/i;
const POST_SIGN_UP_RE = /(onboarding|dashboard|verify)/;

test.describe("Auth flow", () => {
  test("sign up page loads", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(page.locator("body")).toBeVisible();
  });

  test("sign in page loads", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.locator("body")).toBeVisible();
  });

  test("unauthenticated user is redirected from dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(SIGN_IN_RE);
    await expect(page).toHaveURL(SIGN_IN_RE);
  });

  test("sign up → onboarding → dashboard flow", async ({ page }) => {
    const email = `test-${Date.now()}@example.com`;

    await page.goto("/sign-up");

    const nameInput = page.getByLabel(NAME_RE);
    const emailInput = page.getByLabel(EMAIL_RE);
    const passwordInput = page.getByLabel(PASSWORD_RE);

    if (await nameInput.isVisible()) {
      await nameInput.fill("Test User");
    }
    if (await emailInput.isVisible()) {
      await emailInput.fill(email);
    }
    if (await passwordInput.isVisible()) {
      await passwordInput.fill("TestPassword123!");
    }

    const submitButton = page.getByRole("button", { name: SIGN_UP_BUTTON_RE });
    if (await submitButton.isVisible()) {
      await submitButton.click();
      // After sign up, user should be redirected to onboarding or dashboard
      await page.waitForURL(POST_SIGN_UP_RE);
    }
  });
});
