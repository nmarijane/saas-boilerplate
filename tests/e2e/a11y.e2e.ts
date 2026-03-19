import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Accessibility tests using axe-core.
 * Runs automated WCAG 2.1 checks on critical pages.
 *
 * These tests require a running dev server (npm run dev).
 * Run with: npx playwright test tests/e2e/a11y.e2e.ts
 */

test.describe("Accessibility", () => {
  test("landing page has no critical a11y violations", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    expect(results.violations.filter((v) => v.impact === "critical")).toHaveLength(0);
  });

  test("sign-in page has no critical a11y violations", async ({ page }) => {
    await page.goto("/en/sign-in");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    expect(results.violations.filter((v) => v.impact === "critical")).toHaveLength(0);
  });
});
