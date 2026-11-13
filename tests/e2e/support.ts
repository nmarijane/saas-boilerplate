import type { Page } from "@playwright/test";
import { test as base, expect  } from "@playwright/test";
import { createEmailVerificationToken } from "better-auth/api";

/** A client address that is the same for the same test, and not the same for two of them: 10.x.y.z. */
function addressOf(testId: string): string {
  let hash = 0;
  for (const character of testId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return `10.${(hash >>> 16) & 255}.${(hash >>> 8) & 255}.${hash & 255}`;
}

/**
 * `test`, with a client address of its own for each test. The server of these tests is a
 * production one, and Better Auth limits signing in to three attempts in ten seconds for one
 * address (a fourth is refused with a 429, which the form tells to wait): the tests run side
 * by side from one machine, and sign in more often than that. The server takes the address
 * from `X-Forwarded-For`, as it does behind a proxy, so a test that sets it is another
 * client, with a limit of its own.
 */
export const test = base.extend({
  context: async ({ context }, use, testInfo) => {
    await context.setExtraHTTPHeaders({ "x-forwarded-for": addressOf(testInfo.testId) });
    await use(context);
  },
});

/**
 * The alert of the page: a `PageAlert`, which every page draws in the same way. Not
 * `getByRole("alert")`: the route announcer of Next.js is an element of that role too, on
 * every page, and a locator that finds two fails.
 */
export function pageAlert(page: Page) {
  return page.locator('[data-slot="page-alert"][role="alert"]');
}

/** The password of the people of the seed (scripts/seed.ts and scripts/demo-data.ts). */
export const PASSWORD = "admin123";

/** The people of the seed that the tests sign in as, and what each is there for. */
export const PEOPLE = {
  /** Owns the demo workspace (Acme, with its projects) and has finished onboarding. */
  owner: "camille@example.com",
  /** Administers the platform, has finished onboarding and belongs to no workspace. */
  admin: "admin@example.com",
  /**
   * Has not done onboarding and belongs to no workspace. No test completes it: a retry would find it
   * done, so the tests that go through onboarding make a newcomer of their own (`signInAsANewcomer`).
   */
  newcomer: "dev@example.com",
} as const;

/**
 * Opens the sign-in page of a language and waits for its scripts: the page is sent
 * before they have run, and a form sent before then is a plain POST to the page,
 * which signs nobody in.
 */
export async function openSignIn(page: Page, path = "/en/sign-in") {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

/**
 * Signs in through the real form of the page, in English, and presses the button:
 * what comes after is the test's to wait for. The labels are matched whole: the pages
 * have other controls with these words in their names ("Confirm Password", "Show password").
 */
export async function signInThroughTheForm(page: Page, email: string, password = PASSWORD) {
  await openSignIn(page);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
}

/** An address no other test uses, for an account that a test makes. */
export function freshEmail(name: string): string {
  return `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/** The password of the accounts that a test makes: it passes the rules of the sign-up form. */
export const STRONG = "Secret-123!";

/** Makes an account through the real sign-up form, and waits for its confirmation. */
export async function signUpThroughTheForm(page: Page, email: string, path = "/en/sign-up", name = "Not Verified Yet") {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(STRONG);
  await page.getByLabel("Confirm Password", { exact: true }).fill(STRONG);
  await page.getByRole("button", { name: "Sign Up", exact: true }).click();
  await expect(page.getByRole("status")).toBeVisible();
}

/**
 * Follows the link of the verification e-mail of an account. The server of these tests mails nothing, so the
 * link is made as the server makes it: a token signed with the secret of the run (`E2E_AUTH_SECRET`, set by the
 * config of Playwright), which the verify endpoint accepts.
 */
export async function followVerificationLink(page: Page, email: string) {
  const secret = process.env.E2E_AUTH_SECRET;
  if (!secret) {
    throw new Error("E2E_AUTH_SECRET is not set: the config of Playwright draws it for the run");
  }

  const token = await createEmailVerificationToken(secret, email);
  const response = await page.goto(`/api/auth/verify-email?token=${token}&callbackURL=${encodeURIComponent("/en/sign-in")}`);

  expect(response?.status()).toBeLessThan(400);
}

/**
 * Starts listening to what the page asks the server for, and gives the list of the pages it asked for with no
 * language in front (`/dashboard` and not `/en/dashboard`): a redirect that leaves the server without the language
 * is sent to the proxy, which redirects a second time to add it. The list fills as the test goes on.
 */
export function pagesAskedWithoutALanguage(page: Page): string[] {
  const asked: string[] = [];
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    const isPage = !pathname.startsWith("/_next") && !pathname.startsWith("/api") && !pathname.includes(".");
    if (isPage && !/^\/(?:en|fr)(?:\/|$)/.test(pathname)) {
      asked.push(pathname);
    }
  });

  return asked;
}

/** Makes a newcomer of its own (an account with no workspace, onboarding not done), and signs it in: one address per call, so a retry finds nobody half way. */
export async function signInAsANewcomer(page: Page, name = "Dev User") {
  const email = freshEmail("newcomer");
  await signUpThroughTheForm(page, email, "/en/sign-up", name);
  await followVerificationLink(page, email);
  await signInThroughTheForm(page, email, STRONG);

  return email;
}
