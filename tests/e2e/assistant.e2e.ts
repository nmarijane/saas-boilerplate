import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";
import { PEOPLE, signInThroughTheForm, test } from "./support";

// The assistant page in the real app. The server of these tests has no AI provider
// (playwright.config.ts empties the keys), so a workspace's page is the empty state
// that names the variables to set, under the one h1 of the page.

test.describe("the assistant page with no provider on", () => {
  test("names the variables to set, under the one h1 of the page, and draws no chat", async ({ page }) => {
    await signInThroughTheForm(page, PEOPLE.owner);
    await expect(page).toHaveURL(/\/en\/dashboard$/);
    await page.goto("/en/ai");

    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI not configured");
    await expect(page.getByRole("main")).toContainText(
      "Set at least one of OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or GROQ_API_KEY in your environment, then restart the app.",
    );
    await expect(page.getByRole("textbox", { name: "Message" })).toHaveCount(0);
    await expect(page).toHaveTitle(/AI Chat/);

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations).toEqual([]);
  });

  test("says it in French, with the same variables", async ({ page }) => {
    await signInThroughTheForm(page, PEOPLE.owner);
    await expect(page).toHaveURL(/\/en\/dashboard$/);
    await page.goto("/fr/ai");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("IA non configurée");
    await expect(page.getByRole("main")).toContainText(
      "Définissez au moins l'une des variables OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY ou GROQ_API_KEY dans votre environnement, puis redémarrez l'application.",
    );
  });
});
