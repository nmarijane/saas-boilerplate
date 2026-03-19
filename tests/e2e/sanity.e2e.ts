import { expect, test } from "@playwright/test";

const NON_EMPTY_RE = /.+/;

test.describe("Sanity checks", () => {
  test("marketing page loads successfully", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(NON_EMPTY_RE);
    await expect(page.locator("body")).toBeVisible();
  });

  test("marketing page has navigation", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();
  });

  test("pricing page loads", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.locator("body")).toBeVisible();
  });
});
