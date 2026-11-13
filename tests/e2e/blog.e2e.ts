import { expect, test } from "@playwright/test";

// A post of the blog is markdown, drawn by the `markdown` style of the app. The base style of Tailwind
// resets lists, headings and code, and the plugin that `prose` stands for is not installed: a post that
// carried only `prose` classes drew all of them as plain text. What is read here is what the browser
// computed, on the production build, in light and in dark.

const POST = "/en/blog/ai-module-guide";

for (const scheme of ["light", "dark"] as const) {
  test.describe(`a post of the blog, in ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    test("draws its lists, its headings, its code and its table, as the style of the app says", async ({ page }) => {
      await page.goto(POST);
      const article = page.locator("article.markdown");

      await expect(article).toBeVisible();

      const list = article.locator("ul").first();
      await expect(list).toBeVisible();
      expect(await list.evaluate((node) => getComputedStyle(node).listStyleType)).toBe("disc");
      expect(await list.evaluate((node) => Number.parseFloat(getComputedStyle(node).paddingInlineStart))).toBeGreaterThan(0);

      // A heading stands out from the text it heads, and has room before it
      const [paragraph, heading] = await Promise.all([
        article.locator("p").first().evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize)),
        article.locator("h3").first().evaluate((node) => ({
          size: Number.parseFloat(getComputedStyle(node).fontSize),
          weight: Number(getComputedStyle(node).fontWeight),
          before: Number.parseFloat(getComputedStyle(node).marginTop),
        })),
      ]);
      expect(heading.weight).toBeGreaterThanOrEqual(600);
      expect(heading.size).toBeGreaterThanOrEqual(paragraph);
      // 2.5 rem at 16 px, more than the 1.25 rem of an answer of the assistant
      expect(heading.before).toBe(40);

      const code = article.locator("pre").first();
      await expect(code).toBeVisible();
      expect(await code.evaluate((node) => getComputedStyle(node).overflowX)).toBe("auto");
      expect(await code.evaluate((node) => Number.parseFloat(getComputedStyle(node).borderTopWidth))).toBeGreaterThan(0);
      expect(await code.evaluate((node) => getComputedStyle(node).fontFamily)).toMatch(/mono/i);

      const cell = article.locator("td").first();
      await expect(cell).toBeVisible();
      expect(await cell.evaluate((node) => Number.parseFloat(getComputedStyle(node).borderTopWidth))).toBeGreaterThan(0);
    });

    test("keeps its lines to a readable measure, under the title of the post", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(POST);

      const width = await page.locator("article.markdown").evaluate((node) => node.getBoundingClientRect().width);

      // 65 characters of 16 px text: about 650 px, and nothing near the 768 px of the column
      expect(width).toBeGreaterThan(560);
      expect(width).toBeLessThan(720);
    });

    test("does not scroll sideways on a phone", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(POST);

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });

    // The headings of a post have the ids that an address names, and the sticky header (56 px) does not hide the one
    // that the address goes to: the margin is 80 px. A short window, so that the page has to scroll to the heading.
    test("goes to a heading by its anchor, and leaves it clear of the sticky header", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 500 });
      await page.goto(`${POST}#supported-providers`);

      const heading = page.locator("article.markdown h3#supported-providers");
      await expect(heading).toHaveText("Supported Providers");
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

      const top = await heading.evaluate((node) => node.getBoundingClientRect().top);
      expect(top).toBeGreaterThanOrEqual(56);
      expect(top).toBeLessThanOrEqual(100);
    });

    test("tells what the README tells of Ollama", async ({ page }) => {
      await page.goto(POST);

      await expect(page.locator("article.markdown")).toContainText("no model of the list runs on it yet");
      await expect(page.locator("article.markdown")).not.toContainText("Any local model");
    });
  });
}
