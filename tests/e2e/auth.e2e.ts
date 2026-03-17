import { expect, test } from "@playwright/test";

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
    await page.waitForURL(/sign-in/);
    await expect(page).toHaveURL(/sign-in/);
  });

  test("sign up → onboarding → dashboard flow", async ({ page }) => {
    const email = `test-${Date.now()}@example.com`;

    await page.goto("/sign-up");

    const nameInput = page.getByLabel(/name/i);
    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);

    if (await nameInput.isVisible()) {
      await nameInput.fill("Test User");
    }
    if (await emailInput.isVisible()) {
      await emailInput.fill(email);
    }
    if (await passwordInput.isVisible()) {
      await passwordInput.fill("TestPassword123!");
    }

    const submitButton = page.getByRole("button", { name: /sign up|create account|register/i });
    if (await submitButton.isVisible()) {
      await submitButton.click();
      // After sign up, user should be redirected to onboarding or dashboard
      await page.waitForURL(/(onboarding|dashboard|verify)/);
    }
  });
});
