import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { BillingOverview } from "../overview";
import { expect, within } from "storybook/test";
import { Button } from "@/shared/components/ui/button";
import { PLANS } from "../plans";
import { PlanCard } from "./plan-card";

const plan = (id: string) => PLANS.find((candidate) => candidate.id === id)!;
const IN_A_MONTH = new Date("2026-12-14T00:00:00Z");

const paid: BillingOverview = {
  plan: plan("pro"),
  status: "active",
  subscribed: true,
  interval: "monthly",
  periodEnd: IN_A_MONTH,
  trialEnd: null,
  cancelAtPeriodEnd: false,
  stripeCustomerId: "cus_1",
};

const meta = {
  title: "Features/Billing/PlanCard",
  component: PlanCard,
  tags: ["autodocs"],
  args: { overview: paid, orgId: "org_1", currency: "usd", canManage: true },
  parameters: { layout: "padded" },
  decorators: [(Story) => <div className="max-w-3xl"><Story /></div>],
} satisfies Meta<typeof PlanCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A paid plan: what it costs, when it renews, and where the card is kept. */
export const Active: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Renews on")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Manage payment method" })).toBeVisible();
  },
};

export const Yearly: Story = {
  args: { overview: { ...paid, interval: "yearly" } },
};

/** In a free trial: the card and the end date of the trial. */
export const Trial: Story = {
  args: { overview: { ...paid, status: "trialing", trialEnd: new Date("2026-11-27T00:00:00Z") } },
};

/** The plan is paid until the end of the period, and is not renewed. */
export const Cancelling: Story = {
  args: { overview: { ...paid, cancelAtPeriodEnd: true } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Plan ends")).toBeVisible();
  },
};

export const PastDue: Story = {
  args: { overview: { ...paid, status: "past_due" } },
};

/** A workspace that never paid. */
export const Free: Story = {
  args: { overview: { ...paid, plan: plan("free"), subscribed: false, interval: null, periodEnd: null } },
};

/** A member sees the plan and its dates, and is told who manages it: no button. */
export const Member: Story = {
  args: { canManage: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button")).toBeNull();
  },
};

/** A cancelled plan while a payment is failing: the alert of the page is the failure, so the way back is here. */
export const CancelledWithResume: Story = {
  args: { overview: { ...paid, cancelAtPeriodEnd: true }, resume: <Button variant="outline" size="sm">Keep my subscription</Button> },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button", { name: "Keep my subscription" })).toBeVisible();
  },
};
