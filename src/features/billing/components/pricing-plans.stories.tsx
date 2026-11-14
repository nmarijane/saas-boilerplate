import type { Decorator, Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { PLANS } from "../plans";
import { PricingPlans } from "./pricing-plans";

// A story must not leave the page when a link is followed.
const stayHere: Decorator = (Story) => (
  <div
    onClickCapture={(event) => {
      if ((event.target as HTMLElement).closest("a")) {
        event.preventDefault();
      }
    }}
  >
    <Story />
  </div>
);

const meta = {
  title: "Features/Billing/PricingPlans",
  component: PricingPlans,
  tags: ["autodocs"],
  decorators: [stayHere],
  args: {
    plans: PLANS,
    currency: "usd",
    taxExcluded: false,
    yearlySavings: 17,
    ctas: { free: { kind: "free-signup" }, pro: { kind: "signup" }, enterprise: { kind: "signup" } },
  },
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true, navigation: { pathname: "/settings/billing" } }, },
} satisfies Meta<typeof PricingPlans>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A visitor: every button goes to sign-up, with the plan and the period kept in the address. */
export const Visitor: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getAllByRole("listitem").length).toBeGreaterThan(2);
    await expect(canvas.getByText("14-day free trial")).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Start free trial" })).toHaveAttribute("href", expect.stringContaining("/sign-up?plan=pro&interval=monthly"));
  },
};

/** The period rolls the prices and keeps the plan in the address. */
export const Yearly: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: /Yearly/ }));

    // The price rolls into place: it is in the page before it is seen
    await waitFor(() => expect(canvas.getByText("$290")).toBeVisible());
    await expect(canvas.getByRole("link", { name: "Start free trial" })).toHaveAttribute("href", expect.stringContaining("interval=yearly"));
  },
};

/** A signed-in admin who has not paid: the buttons start the payment. */
export const Payer: Story = {
  args: {
    ctas: { free: { kind: "current", href: null }, pro: { kind: "checkout", orgId: "org_1" }, enterprise: { kind: "checkout", orgId: "org_1" } },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button", { name: "Your plan" })).toBeDisabled();
  },
};

/** A subscriber: the plan they are on says so, the others lead to the billing page. */
export const Subscriber: Story = {
  args: {
    ctas: { free: { kind: "change" }, pro: { kind: "current", href: "/settings/billing" }, enterprise: { kind: "change" } },
  },
};

/** After sign-up, with the free plan as a way forward and the plan picked before sign-up recommended. */
export const Choosing: Story = {
  args: {
    ctas: { free: { kind: "continue-free" }, pro: { kind: "checkout", orgId: "org_1" }, enterprise: { kind: "checkout", orgId: "org_1" } },
    chosenPlanId: "enterprise",
    initialInterval: "yearly",
  },
};

/** The owner spent their trial: it is not announced, and the button does not promise it. */
export const TrialSpent: Story = {
  args: {
    trialPlanIds: [],
    ctas: { free: { kind: "current", href: null }, pro: { kind: "checkout", orgId: "org_1" }, enterprise: { kind: "checkout", orgId: "org_1" } },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText("14-day free trial")).toBeNull();
    await expect(within(canvasElement).getByRole("button", { name: "Choose Pro" })).toBeVisible();
  },
};

/** A member can only look: the plans have no buttons. */
export const Member: Story = {
  args: { ctas: { free: { kind: "current", href: null }, pro: { kind: "none" }, enterprise: { kind: "none" } } },
};

/** With Stripe Tax on, prices say they are quoted without VAT. */
export const ExclVat: Story = {
  args: { taxExcluded: true },
};
