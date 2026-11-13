import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Accessibility tests using axe-core.
 * Runs automated WCAG 2.1 A and AA checks on the pages a visitor reaches without
 * signing in, in the real app (`npm run test:e2e` serves it).
 */

const PAGES = [
  ["the landing page", "/en"],
  ["the sign-in page", "/en/sign-in"],
  ["the sign-up page", "/en/sign-up"],
  ["the forgot-password page", "/en/forgot-password"],
  ["the page of a good verification link", "/en/verify-email?verified=1"],
] as const;

test.describe("Accessibility", () => {
  for (const [name, path] of PAGES) {
    test(`${name} has no critical a11y violations`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();

      expect(results.violations.filter((v) => v.impact === "critical")).toHaveLength(0);
    });
  }
});
