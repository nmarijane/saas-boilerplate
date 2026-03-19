import { expect, test } from "@playwright/test";

/**
 * Example E2E test: Full onboarding flow.
 * Demonstrates how to test a multi-step user journey.
 */
test.describe("Onboarding flow", () => {
  test("new user can access sign-up page", async ({ page }) => {
    await page.goto("/en/sign-up");
    await expect(page.getByRole("heading", { name: /sign up/i })).toBeVisible();
  });
});
