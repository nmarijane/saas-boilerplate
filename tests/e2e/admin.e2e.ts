import { expect } from "@playwright/test";
import { pagesAskedWithoutALanguage, PEOPLE, signInThroughTheForm, test } from "./support";

// The address of the administration (/admin) is the address of its first page: it has no page of its own.
// A platform admin lands on the first page the section has, in the language they asked for; anyone else is
// sent where the pages of the administration send them, and is told nothing of what the section holds.

test.describe("the address of the administration", () => {
  test("sends a platform admin to the first page of the section", async ({ page }) => {
    await signInThroughTheForm(page, PEOPLE.admin);
    await expect(page).toHaveURL(/\/en\/onboarding$/);

    const response = await page.goto("/en/admin");

    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/en\/admin\/users$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Users");
  });

  test("keeps the language of the page it was asked in", async ({ page }) => {
    await signInThroughTheForm(page, PEOPLE.admin);
    await expect(page).toHaveURL(/\/en\/onboarding$/);

    await page.goto("/fr/admin");

    await expect(page).toHaveURL(/\/fr\/admin\/users$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Utilisateurs");
  });

  test("sends someone who is not a platform admin to the home, as every page of the section does", async ({ page }) => {
    await signInThroughTheForm(page, PEOPLE.owner);
    await expect(page).toHaveURL(/\/en\/dashboard$/);

    await page.goto("/en/admin");

    await expect(page).toHaveURL(/\/en\/dashboard$/);
  });

  test("asks a visitor with no session to sign in first", async ({ page }) => {
    await page.goto("/en/admin");

    await expect(page).toHaveURL(/\/en\/sign-in/);
  });

  test("sends someone who is not a platform admin to the home in the language they asked for, in one hop", async ({ page }) => {
    await signInThroughTheForm(page, PEOPLE.owner);
    await expect(page).toHaveURL(/\/en\/dashboard$/);
    const bare = pagesAskedWithoutALanguage(page);

    await page.goto("/fr/admin/users");

    await expect(page).toHaveURL(/\/fr\/dashboard$/);
    expect(bare).toEqual([]);
  });
});
