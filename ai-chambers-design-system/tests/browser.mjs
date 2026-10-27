import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { chromium } from "playwright";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "4273",
    "--strictPort",
  ],
  { stdio: "pipe" },
);
await new Promise((resolve, reject) => {
  server.stdout.on("data", (d) => {
    if (String(d).includes("Local:")) resolve();
  });
  server.on("error", reject);
  server.on("exit", (code) => {
    if (code) reject(new Error(`Vite exited ${code}`));
  });
});
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const checks = [];
  const errors = [];
  const axe = [];
page.on("pageerror", (e) => errors.push(e.message));
const check = async (name, f) => {
  await f();
  checks.push(name);
  console.log("PASS", name);
};
try {
  await page.goto("http://127.0.0.1:4273");
  await page.getByRole("table", { name: "runs", exact: true }).waitFor();
  await check("compact heading typography", async () => {
    assert.equal(
      await page.locator("h1").evaluate((el) => getComputedStyle(el).fontSize),
      "18px",
    );
    assert.equal(
      await page
        .locator("h1")
        .evaluate((el) => getComputedStyle(el).fontWeight),
      "500",
    );
  });
  await check("single-line table rows", async () => {
    assert.equal(
      await page
        .locator(".ac-cell")
        .first()
        .evaluate((el) => getComputedStyle(el).whiteSpace),
      "nowrap",
    );
  });
  await check("search/clear restores results", async () => {
    await page
      .getByRole("searchbox", { name: "Search runs" })
      .fill("Matter Assistant");
    assert.equal(await page.locator("tbody tr").count(), 1);
    await page
      .getByRole("button", { name: "Clear search", exact: true })
      .click();
    assert.equal(await page.locator("tbody tr").count(), 5);
  });
  await check("explicit andall-matching selection", async () => {
    await page
      .getByRole("checkbox", { name: "Select RUN024", exact: true })
      .first()
      .check();
    await page.getByRole("button", { name: "Select all 5 matching" }).click();
    assert(
      await page
        .getByRole("region", { name: "Selected records" })
        .innerText()
        .then((x) => x.includes("5 selected")),
    );
    await page
      .getByRole("button", { name: "Clear selection", exact: true })
      .click();
  });
  await check("column visibility andkeyboard resizing", async () => {
    const handle = page.getByRole("separator", { name: "Resize Tool" });
    const before = await handle.getAttribute("aria-valuenow");
    await handle.focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(
      Number(await handle.getAttribute("aria-valuenow")),
      Number(before) + 8,
    );
    await page.getByRole("button", { name: "Columns", exact: true }).click();
    await page.getByRole("checkbox", { name: "Matter", exact: true }).uncheck();
    await page
      .getByRole("button", { name: "Close", exact: true })
      .last()
      .click();
    assert.equal(
      await page
        .getByRole("columnheader", { name: "Matter", exact: true })
        .count(),
      0,
    );
  });
  await check("session saved-view creation", async () => {
    await page
      .getByRole("textbox", { name: "View name" })
      .fill("Compact review");
    await page.getByRole("button", { name: "Save view", exact: true }).click();
    assert(
      await page
        .getByRole("status")
        .innerText()
        .then((x) => x.includes("View saved")),
    );
  });
  await check(
    "saved view actually restores column visibility and widths",
    async () => {
      await page.getByRole("button", { name: "Columns", exact: true }).click();
      await page
        .getByRole("button", { name: "Reset columns", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Close", exact: true })
        .last()
        .click();
      await page
        .getByRole("button", { name: "Saved views", exact: true })
        .click();
      await page
        .getByRole("option", { name: "Compact review", exact: true })
        .click();
      assert.equal(
        await page
          .getByRole("columnheader", { name: "Matter", exact: true })
          .count(),
        0,
      );
      assert.equal(
        Number(
          await page
            .getByRole("separator", { name: "Resize Tool" })
            .getAttribute("aria-valuenow"),
        ),
        268,
      );
    },
  );
  await check("nested filter builder apply", async () => {
    await page.getByRole("button", { name: "Filter", exact: true }).click();
    await page
      .getByRole("button", { name: "Add condition", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Filter value", exact: true })
      .fill("RUN024");
    await page
      .getByRole("button", { name: "Apply filters", exact: true })
      .click();
    assert.equal(await page.locator("tbody tr").count(), 1);
  });
  await check("inspector Escape andfocus restoration", async () => {
    await page.getByRole("button", { name: "RUN024", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(
      await page.evaluate(() => document.activeElement?.textContent),
      "RUN024",
    );
  });
  await check("command palette shortcut", async () => {
    await page.keyboard.press("Control+k");
    await page.getByRole("dialog").waitFor();
    await page
      .getByRole("textbox", { name: "Search commands", exact: true })
      .fill("Settings");
    await page
      .getByRole("dialog")
      .getByRole("link", { name: "Settings", exact: true })
      .waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
  });
  async function audit(label) {
    await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
    const r = await page.evaluate(async () =>
      window.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      }),
    );
    axe.push({
      label,
      violations: r.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
    });
    assert.equal(r.violations.length, 0, JSON.stringify(axe.at(-1)));
  }
  await check("desktop light automated accessibility", () =>
    audit("desktop-light"),
  );
  await page.screenshot({ path: "reports/desktop-light.png", fullPage: true });
  await page.getByRole("button", { name: "Dark theme", exact: true }).click();
  await check("desktop dark automated accessibility", () =>
    audit("desktop-dark"),
  );
  await page.screenshot({ path: "reports/desktop-dark.png", fullPage: true });
  await page
    .getByRole("link", { name: "Workspace settings", exact: true })
    .click();
  await check("authored select search andform validation", async () => {
    await page.getByRole("button", { name: "Timezone", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Search Timezone", exact: true })
      .fill("Perth");
    await page
      .getByRole("option", { name: "Australia/Perth", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Contact email", exact: false })
      .fill("bad@");
    await page.getByRole("button", { name: "Validate changes" }).click();
    await page
      .getByRole("alert")
      .getByText("Enter a valid email address.")
      .waitFor();
  });
  await check("responsive24/12/4 grid geometry", async () => {
    for (const [width, n] of [
      [1440, 24],
      [1024, 12],
      [390, 4],
    ]) {
      await page.setViewportSize({ width, height: 900 });
      const count = await page
        .locator(".ac-grid")
        .evaluate(
          (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
        );
      assert.equal(count, n);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  });
  await page
    .getByRole("link", { name: "Disclosure form", exact: true })
    .click();
  await check("disclosure validation doesnot submit payment", async () => {
    await page
      .getByRole("button", { name: "Validate request", exact: true })
      .click();
    assert(
      await page
        .getByRole("alert")
        .innerText()
        .then((x) => x.includes("Accept the terms")),
    );
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4273/#runs");
  await check("mobile list andno page overflow", async () => {
    await page.locator(".ac-mobile-list").waitFor({ state: "visible" });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.equal(await page.locator(".ac-desktop-table").isVisible(), false);
  });
  await check("mobile sheet andtouch buttons", async () => {
    await page.locator(".ac-mobile-list .ac-record-link").first().click();
    await page.getByRole("dialog").waitFor();
    const close = page
      .getByRole("button", { name: "Close", exact: true })
      .last();
    assert((await close.boundingBox()).height >= 44);
    await close.click();
  });
  await check("mobile automated accessibility", () => audit("mobile-dark"));
  await page.screenshot({ path: "reports/mobile-dark.png", fullPage: true });
  await page.setViewportSize({ width: 360, height: 740 });
  await check("360px reflow", async () => {
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await check("reduced motion removes spatial animations", async () => {
    await page.locator(".ac-mobile-list .ac-record-link").first().click();
    assert.equal(
      await page
        .getByRole("dialog")
        .evaluate((el) => getComputedStyle(el).animationName),
      "none",
    );
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Error state", exact: true }).click();
  await check("error recovery", async () => {
    await page.getByRole("button", { name: "Retry demo load" }).click();
    await page.getByRole("table", { name: "runs", exact: true }).waitFor();
  });
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "reports/browser-checks.json",
    JSON.stringify(
      {
        status: "passed",
        browser: browser.version(),
        checks,
        axe,
        pageErrors: errors,
        limits:
          "Local reference only. Not a manual screen-reader, multi-user backend, full app or cross-browser certification.",
      },
      null,
      2,
    ),
  );
} catch (e) {
  fs.writeFileSync(
    "reports/browser-checks.json",
    JSON.stringify(
      { status: "failed", checks, axe, pageErrors: errors, error: String(e) },
      null,
      2,
    ),
  );
  await page.screenshot({ path: "reports/failure.png", fullPage: true });
  throw e;
} finally {
  await browser.close();
  server.kill();
}
