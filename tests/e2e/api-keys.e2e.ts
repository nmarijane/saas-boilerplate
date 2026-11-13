import { expect } from "@playwright/test";
import { PEOPLE, signInThroughTheForm, test } from "./support";

// The first day a key can end on is tomorrow, and the page and the server each tell tomorrow by their own clock: a
// few minutes before midnight (UTC) they are not the same day, and an end that the page offers is today for the server.
// The server refuses it in its own words, in the language of the request, and answers instead of throwing: on a
// production build (this one) Next hides the text of an error that a server action throws, so a thrown refusal would
// reach the dialog as the generic failure. Here the clock of the page is a day behind the server's.

const DAY = 24 * 60 * 60 * 1000;

const LANGUAGES = [
  {
    locale: "en",
    open: "Create API key",
    name: "Name",
    expires: "Expiration",
    submit: "Create key",
    sentence: (day: string) => `Choose ${day} or later.`,
  },
  {
    locale: "fr",
    open: "Créer une clé d'API",
    name: "Nom",
    expires: "Expiration",
    submit: "Créer la clé",
    sentence: (day: string) => `Choisissez le ${day} ou une date ultérieure.`,
  },
] as const;

/** A day, as the server writes it: long, by the clock of UTC. */
function longDay(locale: string, moment: number): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(moment));
}

for (const language of LANGUAGES) {
  test.describe(`the end of an API key, in ${language.locale}`, () => {
    test("is refused in the words of the server, in the language of the page, when the clock of the page is behind", async ({ page }) => {
      await signInThroughTheForm(page, PEOPLE.owner);
      await expect(page).toHaveURL(/\/en\/dashboard$/);
      // The page believes it is yesterday: today is the first day it offers, and the server takes tomorrow
      await page.clock.setFixedTime(new Date(Date.now() - DAY));

      await page.goto(`/${language.locale}/settings/developers`);
      await page.getByRole("button", { name: language.open, exact: true }).click();
      const dialog = page.getByRole("dialog", { name: language.open });
      await dialog.getByLabel(language.name).fill("Clock test");
      const end = dialog.getByLabel(language.expires);
      await end.fill(new Date().toISOString().slice(0, 10));
      const askedAt = Date.now();
      await dialog.getByRole("button", { name: language.submit }).click();

      // The day the server names is tomorrow by its clock, which moved on if the request crossed midnight (UTC)
      const days = new Set([longDay(language.locale, askedAt + DAY), longDay(language.locale, Date.now() + DAY)]);
      await expect(dialog.getByRole("alert")).toHaveText(new RegExp(`^(?:${[...days].map((day) => language.sentence(day).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})$`));
      await expect(end).toHaveAttribute("aria-invalid", "true");
      await expect(dialog.getByLabel(language.name)).toHaveValue("Clock test");
    });
  });
}
