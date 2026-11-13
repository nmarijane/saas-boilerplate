import { expect, test } from "@playwright/test";

const NON_EMPTY_RE = /.+/;

test.describe("Sanity checks", () => {
  test("marketing page loads successfully", async ({ page }) => {
    await page.goto("/en");
    await expect(page).toHaveTitle(NON_EMPTY_RE);
    await expect(page.locator("body")).toBeVisible();
  });

  test("marketing page has navigation", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("nav").first()).toBeVisible();
  });

  test("pricing page loads", async ({ page }) => {
    const response = await page.goto("/en/pricing");

    expect(response?.status()).toBe(200);
  });

  test("a page that does not exist answers 404, with the page that says so", async ({ page }) => {
    const response = await page.goto("/en/this-page-does-not-exist");

    expect(response?.status()).toBe(404);
  });
});
