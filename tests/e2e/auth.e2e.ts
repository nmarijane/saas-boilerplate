import { expect } from "@playwright/test";
import { freshEmail, openSignIn, pageAlert, PASSWORD, PEOPLE, signInThroughTheForm, signUpThroughTheForm, STRONG, test } from "./support";

// The pages a person goes through to get in, in the real app: the proxy, the real
// forms, the real server. Each test signs in as one of the people of the seed, or
// makes an account of its own.

test.describe("signing in", () => {
  test("signs in the owner of the demo workspace through the form, and lands on the dashboard", async ({ page }) => {
    await signInThroughTheForm(page, PEOPLE.owner);

    await expect(page).toHaveURL(/\/en\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("tells a wrong password in an alert, in the words of the page, and keeps it out of the address", async ({ page }) => {
    await signInThroughTheForm(page, PEOPLE.owner, "not-the-password");

    await expect(pageAlert(page)).toHaveText("Invalid email or password");
    await expect(page).toHaveURL(/\/en\/sign-in$/);
    expect(page.url()).not.toContain("not-the-password");
  });

  // Better Auth limits sign-in to three attempts in ten seconds for one address, and the test has an
  // address of its own (support.ts). The fourth is a 429 with a sentence and no code: the form says to
  // wait, where it used to say that an error occurred. Each attempt is waited for by its answer: a
  // second press while one is on its way is ignored, and the fourth would never be made.
  test("tells a fourth attempt within ten seconds to wait a moment, not that the app failed", async ({ page }) => {
    await openSignIn(page);
    await page.getByLabel("Email", { exact: true }).fill(PEOPLE.owner);
    await page.getByLabel("Password", { exact: true }).fill("not-the-password");

    const statuses: number[] = [];
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const answer = page.waitForResponse((response) => response.url().endsWith("/api/auth/sign-in/email"));
      await page.getByRole("button", { name: "Sign In", exact: true }).click();
      statuses.push((await answer).status());
      await expect(page.getByRole("button", { name: "Sign In", exact: true })).not.toHaveAttribute("aria-disabled", "true");
    }

    expect(statuses).toEqual([401, 401, 401, 429]);
    await expect(pageAlert(page)).toHaveText("Too many attempts. Wait a moment, then try again.");
    await expect(page).toHaveURL(/\/en\/sign-in$/);
  });

  test("sends someone with no session to sign in, and brings them to the page they asked for, in their language", async ({ page }) => {
    await page.goto("/fr/projects");

    await expect(page).toHaveURL(/\/fr\/sign-in\?callbackUrl=%2Ffr%2Fprojects$/);
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Email", { exact: true }).fill(PEOPLE.owner);
    await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Se connecter", exact: true }).click();

    await expect(page).toHaveURL(/\/fr\/projects$/);
  });

  test("goes to the dashboard, not to the address, when the page that was asked for is not a path of the app", async ({ page }) => {
    await page.goto("/en/sign-in?callbackUrl=https%3A%2F%2Fevil.example%2Fphish");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Email", { exact: true }).fill(PEOPLE.owner);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();

    await expect(page).toHaveURL(/\/en\/dashboard$/);
  });

  test("tells a provider that was cancelled when it brings the person back, never the code it came with", async ({ page }) => {
    await page.goto("/en/sign-in?error=access_denied");

    await expect(pageAlert(page)).toHaveText("Sign-in was cancelled. You can try again.");
    await expect(page.getByText("access_denied")).toHaveCount(0);
  });

  // A form that is sent before the scripts of its page have run is sent by the browser as
  // plain HTML. With no method that is a GET, and the password goes into the address.
  test.describe("with no script", () => {
    test.use({ javaScriptEnabled: false });

    test("posts the sign-in form: the password never goes into the address", async ({ page }) => {
      await page.goto("/en/sign-in");
      await page.getByLabel("Email", { exact: true }).fill(PEOPLE.owner);
      await page.getByLabel("Password", { exact: true }).fill("a-password-to-keep-private");
      await page.getByRole("button", { name: "Sign In", exact: true }).click();
      await page.waitForLoadState("load");

      expect(page.url()).not.toContain("a-password-to-keep-private");
      expect(page.url()).not.toContain("password");
      expect(page.url()).not.toContain("email=");
    });
  });
});

test.describe("signing up", () => {
  test("makes the account and says an e-mail is on its way", async ({ page }) => {
    await page.goto("/en/sign-up");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Name", { exact: true }).fill("E2E Person");
    await page.getByLabel("Email", { exact: true }).fill(freshEmail("sign-up"));
    await page.getByLabel("Password", { exact: true }).fill(STRONG);
    await page.getByLabel("Confirm Password", { exact: true }).fill(STRONG);
    await page.getByRole("button", { name: "Sign Up", exact: true }).click();

    await expect(page.getByRole("status")).toHaveText("Email sent! Check your inbox.");
  });

  test("answers an address that has an account as it answers a new one: nothing tells which it is", async ({ page }) => {
    await page.goto("/en/sign-up");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Name", { exact: true }).fill("Somebody Else");
    await page.getByLabel("Email", { exact: true }).fill(PEOPLE.owner);
    await page.getByLabel("Password", { exact: true }).fill(STRONG);
    await page.getByLabel("Confirm Password", { exact: true }).fill(STRONG);
    await page.getByRole("button", { name: "Sign Up", exact: true }).click();

    await expect(page.getByRole("status")).toHaveText("Email sent! Check your inbox.");
  });

  test("tells a person who signs in before they verified the address that a new link is on its way", async ({ page }) => {
    const email = freshEmail("unverified");
    await signUpThroughTheForm(page, email);

    const link = page.waitForRequest((request) => request.url().endsWith("/api/auth/send-verification-email"));
    await signInThroughTheForm(page, email, STRONG);

    await expect(pageAlert(page)).toHaveText(
      "Your email isn't verified yet. We've just sent you a new link: check your inbox.",
    );
    await expect(page).toHaveURL(/\/en\/sign-in$/);
    // The link is the form's own: it comes back to the verify page of the language
    expect((await link).postDataJSON()).toEqual({ email, callbackURL: "/en/verify-email?verified=1" });
  });

  // An invitation sends a person who has no account to sign up, and one who has to sign in, with the
  // page to come back to in the address: the link of sign-in carries it, as the link of sign-up does
  test("sends the link with the page that sent the person, so that verifying leads back to it", async ({ page }) => {
    const email = freshEmail("unverified-invited");
    const callbackUrl = encodeURIComponent("/en/projects");
    await signUpThroughTheForm(page, email, `/en/sign-up?callbackUrl=${callbackUrl}`);

    await openSignIn(page, `/en/sign-in?callbackUrl=${callbackUrl}`);
    const link = page.waitForRequest((request) => request.url().endsWith("/api/auth/send-verification-email"));
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(STRONG);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();

    await expect(pageAlert(page)).toContainText("We've just sent you a new link");
    expect((await link).postDataJSON()).toEqual({
      email,
      callbackURL: `/en/verify-email?verified=1&callbackUrl=${callbackUrl}`,
    });
  });
});

test.describe("the page of a verification link", () => {
  // The form asks for the link of an endpoint that is open to anyone, with the page the link comes back
  // to. A production server refuses a page that is not of the app, so that a link in the mail of the
  // app cannot lead to another site once the address is verified
  test("is never asked to come back to another site", async ({ request }) => {
    for (const callbackURL of ["https://evil.example/phish", "//evil.example/phish"]) {
      const answer = await request.post("/api/auth/send-verification-email", {
        data: { email: PEOPLE.newcomer, callbackURL },
        headers: { "x-forwarded-for": "10.99.0.1" },
      });

      expect(answer.status(), callbackURL).toBe(403);
      expect((await answer.json()).code, callbackURL).toBe("INVALID_CALLBACK_URL");
    }
  });

  test("tells a good link that the address is verified, and leads to sign in", async ({ page }) => {
    await page.goto("/en/verify-email?verified=1");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Email verified");
    await page.getByRole("link", { name: "Sign In", exact: true }).click();

    await expect(page).toHaveURL(/\/en\/sign-in$/);
  });

  test("tells a dead link, in French when the link is", async ({ page }) => {
    await page.goto("/fr/verify-email?verified=1&error=INVALID_TOKEN");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ce lien ne fonctionne plus");
  });
});

test.describe("the page of a reset link", () => {
  test("takes the token out of the address and keeps it for the form", async ({ page }) => {
    await page.goto("/en/reset-password?token=a-token-that-is-nobodys");
    await page.waitForLoadState("networkidle");

    await expect(page).not.toHaveURL(/token=/);
    expect(page.url()).toMatch(/\/en\/reset-password$/);

    // The token is still there to be sent: the server refuses it, and the page says so
    await page.getByLabel("New password", { exact: false }).first().fill(STRONG);
    await page.getByRole("button", { name: "Reset Password", exact: true }).click();

    await expect(pageAlert(page)).toContainText("This link has expired or was already used.");
  });
});

// The router of Next has to hear of the new address as well as the address bar. If it kept the old one,
// its next change (a refresh, a server action, Fast Refresh) would ask for the page with the token and
// write it back to the bar. Heard of it, the router asks for the page without it, and the page, which reads
// the token on the server, tells the link no longer works: as a reload does. The token lives in the form alone.
test.describe("the page of a reset link, when the router refreshes it", () => {
  test("asks for the page without the token and writes none back to the address", async ({ page }) => {
    await page.goto("/en/reset-password?token=a-token-that-is-nobodys");
    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/token=/);

    const refreshed = page.waitForRequest((request) => request.url().includes("_rsc="));
    await page.evaluate(() => (window as unknown as { next: { router: { refresh: () => void } } }).next.router.refresh());

    expect((await refreshed).url()).not.toContain("token=");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This link no longer works");
    await expect(page).not.toHaveURL(/token=/);
    expect(page.url()).toMatch(/\/en\/reset-password$/);
  });
});

test.describe("reaching a page of the app without a session", () => {
  test("sends the visitor to sign in", async ({ page }) => {
    await openSignIn(page, "/en/dashboard");

    await expect(page).toHaveURL(/\/en\/sign-in/);
  });
});
