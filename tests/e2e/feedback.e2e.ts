import { Buffer } from "node:buffer";
import { expect } from "@playwright/test";
import { PEOPLE, signInThroughTheForm, test } from "./support";

// A screenshot that the server refuses is told to the person, in the language of the page: the route answers a 400
// that says why (`{ error, code, status, values }`), the hook of the upload reads it, and the dialog shows the message
// of the locales with the limit the server gave. Here it is the whole chain, on the production build, with a file that
// is one byte over the limit.

const LANGUAGES = [
  {
    locale: "en",
    open: "Send feedback",
    tooLarge: "This file is too large. The maximum size is 10 MB.",
  },
  {
    locale: "fr",
    open: "Envoyer un feedback",
    tooLarge: "Ce fichier est trop volumineux. La taille maximale est de 10 Mo.",
  },
] as const;

const ONE_BYTE_TOO_MANY = 10_000_001;

for (const language of LANGUAGES) {
  test.describe(`a screenshot for the feedback, in ${language.locale}`, () => {
    test("that is too large is refused with the message of the page's language and the limit", async ({ page }) => {
      await signInThroughTheForm(page, PEOPLE.owner);
      await expect(page).toHaveURL(/\/en\/dashboard$/);

      await page.goto(`/${language.locale}/dashboard`);
      await page.getByRole("button", { name: language.open, exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Feedback" });
      await dialog.locator('input[type="file"]').setInputFiles({
        name: "big.png",
        mimeType: "image/png",
        buffer: Buffer.alloc(ONE_BYTE_TOO_MANY),
      });

      await expect(dialog.getByRole("alert")).toHaveText(language.tooLarge);
    });

    test("of a type that is not taken is refused, and names the type", async ({ page }) => {
      await signInThroughTheForm(page, PEOPLE.owner);
      await expect(page).toHaveURL(/\/en\/dashboard$/);

      await page.goto(`/${language.locale}/dashboard`);
      await page.getByRole("button", { name: language.open, exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Feedback" });
      await dialog.locator('input[type="file"]').setInputFiles({
        name: "setup.exe",
        mimeType: "application/x-msdownload",
        buffer: Buffer.from("MZ"),
      });

      await expect(dialog.getByRole("alert")).toContainText("application/x-msdownload");
    });
  });
}
