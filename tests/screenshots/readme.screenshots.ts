import type { Locator, Page, TestInfo } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { OTHER_BRAND } from "../../src/shared/components/foundations/other-brand";
import { savePng } from "./save-png";

// One test per picture of the README, in each project that shows it: it opens
// the page, does what the picture shows (a menu open, another brand), waits
// until the page is done and saves it as docs/screenshots/<name>-<project>.png.
// The projects are the devices and color schemes of the config; a picture made
// for one kind of screen is skipped on the other.

const onDesktop = (testInfo: TestInfo) =>
  testInfo.project.name.startsWith("desktop");

/** Done: the fonts are in, no request is left, and no loading state is on the screen. */
async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

/** Saves the picture once the page is done, after whatever the test did to it. */
async function capture(page: Page, testInfo: TestInfo, name: string) {
  await settle(page);
  await savePng(page, testInfo, name);
}

/** A finger on the middle of a button, as on a phone: no scroll comes before it, as `click()` makes one to reach a sticky bar. */
async function tap(trigger: Locator) {
  const box = await trigger.boundingBox();
  if (!box) {
    throw new Error("The button to tap is not on the page");
  }

  await trigger
    .page()
    .touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

/**
 * Opens a popover or a drawer. A press made before the page's scripts have run
 * does nothing, so it is made again until the panel is there; it is not made
 * once the panel is open, which would close it.
 */
async function open(
  trigger: Locator,
  panel: Locator,
  press: (trigger: Locator) => Promise<void> = (button) => button.click(),
) {
  await expect(async () => {
    if (!(await panel.isVisible())) {
      await press(trigger);
    }
    await expect(panel).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

/** The page of the workspace home, as its person reads it. */
async function openHome(page: Page) {
  await page.goto("/en/dashboard");
  await expect(
    page.getByRole("heading", { level: 1, name: "Hello Camille" }),
  ).toBeVisible();
}

test("home", async ({ page }, testInfo) => {
  await openHome(page);

  await capture(page, testInfo, "home");
});

test("prices", async ({ page }, testInfo) => {
  test.skip(!onDesktop(testInfo), "a picture of the desktop layout");

  await page.goto("/en/pricing");
  await expect(page.getByRole("heading", { level: 1, name: "Simple, transparent pricing" })).toBeVisible();
  await page.getByRole("button", { name: /Yearly/ }).click();
  await expect(page.getByText("$290", { exact: true })).toBeVisible();

  await capture(page, testInfo, "prices");
});

test("billing", async ({ page }, testInfo) => {
  test.skip(!onDesktop(testInfo), "a picture of the desktop layout");

  await page.goto("/en/settings/billing");
  await expect(page.getByRole("heading", { level: 1, name: "Billing" })).toBeVisible();
  await expect(page.getByText(/left of 5,000 this month/)).toBeVisible();

  await capture(page, testInfo, "billing");
});

test("projects", async ({ page }, testInfo) => {
  test.skip(!onDesktop(testInfo), "a picture of the desktop layout");

  await page.goto("/en/projects");
  await expect(page.getByText("12 projects")).toBeVisible();

  await capture(page, testInfo, "projects");
});

test("switcher", async ({ page }, testInfo) => {
  test.skip(!onDesktop(testInfo), "a picture of the desktop layout");

  await openHome(page);
  await open(
    page.getByRole("complementary").getByRole("button", { name: /Acme/ }),
    page.getByRole("dialog", { name: "Switch workspace" }),
  );

  await capture(page, testInfo, "switcher");
});

test("team", async ({ page }, testInfo) => {
  test.skip(!onDesktop(testInfo), "a picture of the desktop layout");

  await page.goto("/en/settings/team");
  await expect(page.getByText("Tom Becker")).toBeVisible();

  await capture(page, testInfo, "team");
});

test("assistant", async ({ page }, testInfo) => {
  test.skip(!onDesktop(testInfo), "a picture of the desktop layout");

  // The page opens the latest conversation of the workspace: the one of the demo
  await page.goto("/en/ai");
  await expect(page.getByText("Meet Orbit")).toBeVisible();
  // The balance is read once the page is up: 5,000 granted, 4,120 used
  await expect(page.getByText("880 credits")).toBeVisible();

  await capture(page, testInfo, "assistant");
});

test("menu", async ({ page }, testInfo) => {
  test.skip(onDesktop(testInfo), "a picture of the phone layout");

  await openHome(page);
  // The picture is taken with the page at its top. Opening the drawer is not
  // to move the page, and the test says so rather than hide it: a drawer that
  // scrolls the page fails here.
  await page.evaluate(() => window.scrollTo(0, 0));
  await open(
    page.getByRole("button", { name: "More", exact: true }),
    page.getByRole("dialog", { name: "Menu" }),
    tap,
  );
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await capture(page, testInfo, "menu");
});

// The tokens go on <html>, where the derived ones (the tints, the focus ring,
// the bar) are computed from them: no attribute is needed there. Light only:
// the picture is set beside the home in the default theme.
test("rebrand", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-light", "one picture, in light");

  await openHome(page);
  await page.evaluate((tokens) => {
    for (const [name, value] of Object.entries(tokens)) {
      document.documentElement.style.setProperty(name, value);
    }
  }, OTHER_BRAND);

  await capture(page, testInfo, "rebrand");
});
