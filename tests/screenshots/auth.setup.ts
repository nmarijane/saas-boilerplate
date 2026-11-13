import { expect, test as setup } from "@playwright/test";
import { SIGNED_IN } from "./signed-in";

// Camille owns the demo workspace (scripts/demo-data.ts). The session is saved
// where every project of playwright.screenshots.config.ts reads it.

setup("sign in as Camille", async ({ page }) => {
  // The page is sent before its scripts have run, and a form sent before then is
  // a POST to the page, which signs nobody in (the password is not put in the
  // address: the forms post). So the sign-in is made again, from the page, until
  // it takes, as a press on a menu is in readme.screenshots.ts.
  await expect(async () => {
    await page.goto("/en/sign-in");

    // The labels are matched whole: the page has other controls with these words in their names
    await page.getByLabel("Email", { exact: true }).fill("camille@example.com");
    await page.getByLabel("Password", { exact: true }).fill("admin123");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();

    await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15_000 });
  }).toPass({ timeout: 60_000 });

  await page.context().storageState({ path: SIGNED_IN });
});
