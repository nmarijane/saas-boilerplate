import type { ConsoleMessage, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { PEOPLE, signInThroughTheForm, test } from "./support";

// The Content-Security-Policy is enforced (src/proxy.ts, src/shared/lib/csp.ts): the pages must work under it.
// A script or style the policy blocks is a violation, which the browser reports in its console; the pages of the
// app are opened here with the console watched, and none may report one.

/** What the browser says when the policy stops something: Chrome starts these messages with the same sentences. */
function watchViolations(page: Page): string[] {
  const violations: string[] = [];
  const read = (message: ConsoleMessage) => {
    const text = message.text();
    if (/Content Security Policy|Content-Security-Policy|violates the following/i.test(text)) {
      violations.push(text);
    }
  };
  page.on("console", read);
  page.on("pageerror", (error) => {
    if (/Content Security Policy/i.test(error.message)) {
      violations.push(error.message);
    }
  });

  return violations;
}

test.describe("the pages under the Content-Security-Policy", () => {
  test("sends it enforced, with a nonce of its own for each request, and never report-only", async ({ request }) => {
    const nonces = new Set<string>();
    for (let visit = 0; visit < 3; visit += 1) {
      const response = await request.get("/en");
      const policy = response.headers()["content-security-policy"] ?? "";

      expect(policy).toContain("script-src 'self' 'nonce-");
      expect(policy).not.toContain("'unsafe-inline'; style-src"); // scripts have no 'unsafe-inline'
      expect(policy).toContain("frame-ancestors 'none'");
      expect(response.headers()["content-security-policy-report-only"]).toBeUndefined();
      nonces.add(/'nonce-([^']+)'/.exec(policy)?.[1] ?? "");
    }
    expect(nonces.size).toBe(3);
    expect(nonces.has("")).toBe(false);
  });

  // The matcher of the proxy skips Next internals and files with a known extension, not every path with a dot
  test("is sent on a path that only holds a dot, and the answers of the API carry a closed one", async ({ request }) => {
    const dotted = await request.get("/en/waitlist/a.b");
    const api = await request.get("/api/health");

    expect(dotted.headers()["content-security-policy"]).toContain("'nonce-");
    expect(api.headers()["content-security-policy"]).toBe("default-src 'none'; frame-ancestors 'none'");
  });

  test("puts the nonce of the request on the scripts of the page", async ({ request }) => {
    const response = await request.get("/en/sign-in");
    const nonce = /'nonce-([^']+)'/.exec(response.headers()["content-security-policy"] ?? "")?.[1];
    const html = await response.text();
    const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map(([, attributes]) => attributes ?? "");
    // A script that executes: not a data block (JSON-LD, the data of Next)
    const executable = scripts.filter((attributes) => !/type="(?:application\/ld\+json|application\/json)"/.test(attributes));

    expect(nonce).toBeTruthy();
    expect(executable.length).toBeGreaterThan(0);
    for (const attributes of executable) {
      expect(attributes).toContain(`nonce="${nonce}"`);
    }
  });

  test("lets the home, the sign-in page, the dashboard and the assistant run without a violation", async ({ page }) => {
    const violations = watchViolations(page);

    await page.goto("/en");
    await page.waitForLoadState("networkidle");
    await page.goto("/en/sign-in");
    await page.waitForLoadState("networkidle");
    await signInThroughTheForm(page, PEOPLE.owner);
    await expect(page).toHaveURL(/\/en\/dashboard$/);
    await page.waitForLoadState("networkidle");
    await page.goto("/en/ai");
    await page.waitForLoadState("networkidle");
    await page.goto("/fr");
    await page.waitForLoadState("networkidle");

    // The pages are interactive, which only hydration under the policy lets them be
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    expect(violations).toEqual([]);
  });

  test("keeps the theme script working: it sets the theme before the first paint", async ({ page }) => {
    const violations = watchViolations(page);
    await page.emulateMedia({ colorScheme: "dark" });

    await page.goto("/en/sign-in");

    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(violations).toEqual([]);
  });

  // What an injected script looks like: markup in the page, inline, with no nonce. The page is the real one, with its
  // real policy, and one such script added to it
  test("does not run a script that has no nonce", async ({ page, request }) => {
    const real = await request.get("/en/sign-in");
    const body = (await real.text()).replace("</body>", "<script>window.__injected = true</script></body>");
    await page.route("**/en/sign-in", (route) => route.fulfill({ status: 200, headers: real.headers(), contentType: "text/html", body }));
    const violations = watchViolations(page);

    await page.goto("/en/sign-in");

    expect(await page.evaluate(() => (window as unknown as { __injected?: boolean }).__injected)).toBeUndefined();
    expect(violations.some((violation) => /script-src/.test(violation))).toBe(true);
  });
});
