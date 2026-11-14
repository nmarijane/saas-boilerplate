import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { CheckoutSessionView } from "../checkout-status";
import { expect, within } from "storybook/test";
import { CheckoutSummary } from "./checkout-summary";

const session: CheckoutSessionView = {
  id: "cs_1",
  orgId: "org_1",
  kind: "subscription",
  planId: "pro",
  interval: "monthly",
  packId: null,
  status: "open",
  clientSecret: "secret",
  trialDays: null,
  subscriptionId: null,
};

const meta = {
  title: "Features/Billing/CheckoutSummary",
  component: CheckoutSummary,
  tags: ["autodocs"],
  args: { session, currency: "usd", taxExcluded: false },
  parameters: { layout: "centered" },
  decorators: [(Story) => <div className="w-96 max-w-full"><Story /></div>],
} satisfies Meta<typeof CheckoutSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Monthly: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Due today")).toBeVisible();
  },
};

export const Yearly: Story = { args: { session: { ...session, interval: "yearly" } } };

/** A trial: nothing today, then the price from the date the trial ends. */
export const Trial: Story = {
  args: { session: { ...session, trialDays: 14 } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Your 14-day free trial starts now/)).toBeVisible();
  },
};

export const ExclVat: Story = { args: { taxExcluded: true } };

export const CreditPack: Story = {
  args: { session: { ...session, kind: "credit_pack", planId: null, interval: null, packId: "credits-1000" } },
};
