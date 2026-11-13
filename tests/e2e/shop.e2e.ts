import { expect } from "@playwright/test";
import { followVerificationLink, freshEmail, pageAlert, PEOPLE, signInAsANewcomer, signInThroughTheForm, signUpThroughTheForm, STRONG, test } from "./support";

// The purchase path, as far as it goes without Stripe: the app of these tests has no payment provider (no key,
// the config of Playwright empties them), so what is run for real is the public prices, the plan kept through
// sign-up, the choice of a plan after onboarding, the billing page, the locks, and what the app says when a payment
// cannot be opened. The payment itself, the webhook and the e-mails are the business of the integration tests (a mocked
// Stripe client and signed payloads): nothing here ran against Stripe.

/** Signs in as the owner of the demo workspace, and waits until the app has let them in: a page asked for before that is asked for without a session. */
async function signInAsTheOwner(page: import("@playwright/test").Page) {
  await signInThroughTheForm(page, PEOPLE.owner);
  await expect(page).toHaveURL(/\/en\/dashboard$/);
}

test.describe("the public prices", () => {
  test("show the three plans, roll the prices with the period, and lead a visitor to sign-up with the plan kept", async ({ page, context }) => {
    await page.goto("/en/pricing");

    await expect(page.getByRole("heading", { level: 1, name: "Simple, transparent pricing" })).toBeVisible();
    for (const name of ["Free", "Pro", "Enterprise"]) {
      await expect(page.getByRole("heading", { level: 3, name, exact: true })).toBeVisible();
    }
    await expect(page.getByText("$29", { exact: true })).toBeVisible();
    await expect(page.getByText("14-day free trial")).toBeVisible();

    const yearly = page.getByRole("button", { name: /Yearly/ });
    await yearly.click();
    await expect(yearly).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("$290", { exact: true })).toBeVisible();
    await expect(page.getByText("$990", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Start free trial" }).click();

    await expect(page).toHaveURL(/\/en\/sign-up\?plan=pro&interval=yearly$/);
    const remembered = (await context.cookies()).find((cookie) => cookie.name === "plan_choice");
    expect(remembered?.value).toBe("pro%3Ayearly");
    expect(remembered?.httpOnly).toBe(true);
  });

  test("compare the plans in a table, and answer the questions a buyer asks", async ({ page }) => {
    await page.goto("/en/pricing");

    const table = page.getByRole("table");
    await expect(table.getByRole("columnheader")).toHaveCount(4);
    await expect(table.getByRole("rowheader", { name: "Team Members" })).toBeVisible();

    await page.getByText("Can I cancel at any time?").click();
    await expect(page.getByText(/You keep your plan until the end of the period/)).toBeVisible();
  });

  test("give a visitor on a phone a menu with the way in: sign in, and the free trial", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/en/pricing");

    await page.getByRole("button", { name: "Menu" }).click();

    const menu = page.getByRole("dialog");
    await expect(menu.getByRole("link", { name: "Pricing" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Free trial" })).toHaveAttribute("href", /sign-up\?plan=pro&interval=monthly/);
    const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(scroll).toBeLessThanOrEqual(client);
  });

  test("tell a subscriber which plan is theirs, and lead them to the others through their billing page", async ({ page }) => {
    await signInAsTheOwner(page);

    await page.goto("/en/pricing");

    await expect(page.getByRole("link", { name: "Your plan" })).toHaveAttribute("href", "/en/settings/billing");
    await expect(page.getByRole("link", { name: "Change plan" })).toHaveCount(2);
  });
});

test.describe("the billing page", () => {
  test("shows the plan, what it costs and when it renews, the credits, and the zones only the owner has", async ({ page }) => {
    await signInAsTheOwner(page);
    await page.goto("/en/settings/billing");

    await expect(page.getByRole("heading", { level: 1, name: "Billing" })).toBeVisible();
    await expect(page.getByRole("main").getByText("Pro plan")).toBeVisible();
    await expect(page.getByText("Renews on")).toBeVisible();
    await expect(page.getByText(/left of 5,000 this month/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Top up credits" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Cancel subscription" })).toBeVisible();
  });

  test("changes the plan in a dialog of cards, and confirms nothing until another plan is picked", async ({ page }) => {
    await signInAsTheOwner(page);
    await page.goto("/en/settings/billing");

    await page.getByRole("button", { name: "Change plan" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("radio", { name: /Pro \(current\)/ })).toBeChecked();
    await expect(dialog.getByRole("button", { name: "Confirm the change" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("asks before it cancels, and says what happens", async ({ page }) => {
    await signInAsTheOwner(page);
    await page.goto("/en/settings/billing");

    await page.getByRole("button", { name: "Cancel subscription" }).click();

    const confirm = page.getByRole("alertdialog");
    await expect(confirm.getByText(/keeps the plan until/)).toBeVisible();
    await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(confirm).toBeHidden();
  });

  test("tells when a payment cannot be opened, and keeps the page as it is", async ({ page }) => {
    await signInAsTheOwner(page);
    await page.goto("/en/settings/billing");

    await page.getByRole("button", { name: "Top up credits" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Continue to payment" }).click();

    await expect(page.getByText("Payments are not set up yet. Try again later.")).toBeVisible();
    await expect(page).toHaveURL(/\/en\/settings\/billing$/);
  });
});

test.describe("what stands in for a checkout that does not exist", () => {
  test("is a page not found, for an address that no one opened", async ({ page }) => {
    await signInAsTheOwner(page);

    await page.goto("/en/checkout/cs_nobody_opened_this");

    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  });

  test("sends a buyer who comes back from a payment that cannot be found to the prices, with no error", async ({ page }) => {
    await signInAsTheOwner(page);

    await page.goto("/en/checkout/return?session_id=cs_nobody_opened_this");

    await expect(page).toHaveURL(/\/en\/pricing$/);
    await expect(pageAlert(page)).toHaveCount(0);
  });

  test("needs a session: a visitor is sent to sign in", async ({ page }) => {
    await page.goto("/en/checkout/cs_x");

    await expect(page).toHaveURL(/\/en\/sign-in\?callbackUrl=/);
  });
});

test.describe("after onboarding", () => {
  async function throughOnboarding(page: import("@playwright/test").Page, workspace: string) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByLabel("Workspace name").fill(workspace);
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }

  test("locks the invitations of a workspace on the free plan, with Later, then leads to the choice of a plan", async ({ page }) => {
    await signInAsANewcomer(page);
    await expect(page).toHaveURL(/\/en\/onboarding$/);

    await throughOnboarding(page, "Shop Studio");

    await expect(page.getByRole("heading", { level: 1, name: "Invite your team" })).toBeVisible();
    await expect(page.getByText("Inviting teammates")).toBeVisible();
    await expect(page.getByText("Included in the Pro plan")).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await page.getByRole("button", { name: "Later", exact: true }).click();

    await expect(page).toHaveURL(/\/en\/choose-plan\?from=onboarding$/);
    await expect(page.getByRole("heading", { level: 1, name: "Choose a plan for Shop Studio" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue on Free" })).toBeVisible();

    // No payment provider here: the button says so instead of opening nothing
    await page.getByRole("button", { name: "Start free trial" }).click();
    await expect(page.getByText("Payments are not set up yet. Try again later.")).toBeVisible();
    await expect(page).toHaveURL(/\/en\/choose-plan/);

    await page.getByRole("button", { name: "Continue on Free" }).click();
    await expect(page).toHaveURL(/\/en\/dashboard$/);
  });

  test("resumes the plan that was picked on the prices before signing up", async ({ page }) => {
    const email = freshEmail("resume");
    await signUpThroughTheForm(page, email, "/en/sign-up?plan=enterprise&interval=yearly");
    await followVerificationLink(page, email);
    await signInThroughTheForm(page, email, STRONG);
    await expect(page).toHaveURL(/\/en\/onboarding$/);

    await throughOnboarding(page, "Resume Studio");
    await page.getByRole("button", { name: "Later", exact: true }).click();

    // The plan is Enterprise, yearly, as it was picked: it is the recommended one, and the payment is started for it
    await expect(page).toHaveURL(/\/en\/choose-plan/);
    await expect(page.getByText("Payments are not set up yet. Try again later.")).toBeVisible();
    const enterprise = page.locator('[data-slot="plan-card"]').filter({ hasText: "Enterprise" });
    await expect(enterprise.getByText("Recommended")).toBeVisible();
    await expect(page.getByText("$990", { exact: true })).toBeVisible();
  });

  test("refuses a second workspace on the free plan, and says which plan lifts the limit", async ({ page }) => {
    await signInAsANewcomer(page);
    await throughOnboarding(page, "First Free");
    await page.getByRole("button", { name: "Later", exact: true }).click();
    await page.getByRole("button", { name: "Continue on Free" }).click();
    await expect(page).toHaveURL(/\/en\/dashboard$/);

    await page.getByRole("button", { name: /First Free/ }).first().click();
    await page.getByText("Create workspace", { exact: true }).click();
    await page.getByLabel("Workspace name").fill("Second Free");
    await page.getByRole("button", { name: "Create", exact: true }).click();

    await expect(page.getByText("More workspaces")).toBeVisible();
    await expect(page.getByText("Included in the Pro plan")).toBeVisible();
  });
});
