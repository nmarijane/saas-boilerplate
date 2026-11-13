import { expect } from "@playwright/test";
import { pagesAskedWithoutALanguage, PEOPLE, signInAsANewcomer, signInThroughTheForm, test } from "./support";

// Onboarding, in the real app. The two people of the seed who are sent to it have no
// workspace: the one who has not done it (the newcomer), and the one who has (the admin
// of the platform). Each test that needs a newcomer makes one of its own, through the real sign-up form, with an
// address of its own: a test that completes onboarding would leave nobody to be a newcomer for its retry.

const step = (page: import("@playwright/test").Page, name: string) =>
  page.getByRole("heading", { level: 1, name, exact: true });

test.describe("onboarding", () => {
  test("takes a newcomer through the three steps to the dashboard of their new workspace", async ({ page }) => {
    await signInAsANewcomer(page);

    await expect(page).toHaveURL(/\/en\/onboarding$/);
    await expect(step(page, "Your profile")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Setup progress" })).toHaveAttribute("aria-valuetext", "Step 1 of 3");
    // The field starts with the name they signed up with, once the session has answered
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Dev User");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // The name of the workspace is all that is asked: nobody picks an address
    await expect(step(page, "Your workspace")).toBeVisible();
    await expect(step(page, "Your workspace")).toBeFocused();
    await expect(page.getByRole("textbox")).toHaveCount(1);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText("Enter a name for your workspace.")).toBeVisible();
    await page.getByLabel("Workspace name").fill("E2E Studio");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await expect(step(page, "Invite your team")).toBeVisible();
    await page.getByRole("button", { name: "Skip for now", exact: true }).click();

    await expect(page).toHaveURL(/\/en\/dashboard$/);
  });

  test("onboards again, from the workspace step, a person who is done and has no workspace: no loop, and the admin pages stay open", async ({ page }) => {
    await signInThroughTheForm(page, PEOPLE.admin);

    // The dashboard sent them to onboarding, which used to send them straight back
    await expect(page).toHaveURL(/\/en\/onboarding$/);
    await expect(step(page, "Your workspace")).toBeVisible();
    // They finished it long ago: nothing to go back to
    await expect(page.getByRole("button", { name: "Back", exact: true })).toHaveCount(0);

    const admin = await page.goto("/en/admin/users");

    expect(admin?.status()).toBe(200);
    await expect(page).toHaveURL(/\/en\/admin\/users$/);
  });

  test("lets a person who is stuck there sign out", async ({ page }) => {
    await signInThroughTheForm(page, PEOPLE.admin);
    await expect(page).toHaveURL(/\/en\/onboarding$/);

    await page.getByRole("button", { name: "Sign out", exact: true }).click();

    await expect(page).toHaveURL(/\/en\/sign-in$/);
    // The session is over: the app asks to sign in again
    await page.goto("/en/onboarding");
    await expect(page).toHaveURL(/\/en\/sign-in/);
  });

  // The guards send people away in the language they asked for: the address leaves the server complete, so the
  // browser is not redirected a second time by the proxy to add it
  test("sends a newcomer who asks for a page of the app to onboarding, in the language they asked for, in one hop", async ({ page }) => {
    await signInAsANewcomer(page);
    await expect(page).toHaveURL(/\/en\/onboarding$/);
    const bare = pagesAskedWithoutALanguage(page);

    await page.goto("/fr/projects");

    await expect(page).toHaveURL(/\/fr\/onboarding$/);
    expect(bare).toEqual([]);
  });

  test("sends the admin of the platform, who has no workspace, to onboarding in the language they asked for", async ({ page }) => {
    await signInThroughTheForm(page, PEOPLE.admin);
    await expect(page).toHaveURL(/\/en\/onboarding$/);
    const bare = pagesAskedWithoutALanguage(page);

    await page.goto("/fr/dashboard");

    await expect(page).toHaveURL(/\/fr\/onboarding$/);
    expect(bare).toEqual([]);
  });

  // The server refuses an invitation to someone who is a member already: the step says so and keeps the row
  test("keeps the row the server refused on the invite step, says so, and leaves only when the person skips", async ({ page }) => {
    const email = await signInAsANewcomer(page);
    await expect(page).toHaveURL(/\/en\/onboarding$/);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByLabel("Workspace name").fill("E2E Invites");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(step(page, "Invite your team")).toBeVisible();

    // The owner of the new workspace invites themself: a member already, so the server says no
    await page.getByLabel("Email address of person 1").fill(email);
    await page.getByRole("button", { name: "Complete Setup", exact: true }).click();

    await expect(page.locator('[data-slot="page-alert"][role="alert"]')).toContainText("We couldn't send every invitation.");
    await expect(page.getByLabel("Email address of person 1")).toHaveValue(email);
    await expect(step(page, "Invite your team")).toBeVisible();
    // Nothing is said to have gone that did not
    await expect(page.getByText("Success")).toHaveCount(0);

    await page.getByRole("button", { name: "Skip for now", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/dashboard$/);
  });
});
