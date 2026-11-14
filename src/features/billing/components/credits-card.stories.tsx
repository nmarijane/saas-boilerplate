import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { CreditsCard } from "./credits-card";

const meta = {
  title: "Features/Billing/CreditsCard",
  component: CreditsCard,
  tags: ["autodocs"],
  args: {
    credits: { unlimited: false, monthly: 5000, allocation: 4120, packs: 0, total: 4120 },
    orgId: "org_1",
    currency: "usd",
    canTopUp: true,
    nextGrant: new Date("2026-12-01T00:00:00Z"),
  },
  parameters: { layout: "centered", nextjs: { appDirectory: true, navigation: { pathname: "/settings/billing" } }, },
  decorators: [(Story) => <div className="w-80"><Story /></div>],
} satisfies Meta<typeof CreditsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** What is left of this month's credits, out of what the plan grants. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("4,120")).toBeVisible();
    await expect(canvas.getByText("left of 5,000 this month")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Top up credits" })).toBeVisible();
  },
};

/** Credits that were bought never expire, and are said apart. */
export const WithPacks: Story = {
  args: { credits: { unlimited: false, monthly: 5000, allocation: 0, packs: 1000, total: 1000 } },
};

export const AlmostOut: Story = {
  args: { credits: { unlimited: false, monthly: 100, allocation: 12, packs: 0, total: 12 } },
};

export const Unlimited: Story = {
  args: { credits: { unlimited: true, monthly: 0, allocation: 0, packs: 0, total: 0 } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button", { name: "Top up credits" })).toBeNull();
  },
};

/** A member can see what is left, not buy more. */
export const Member: Story = {
  args: { canTopUp: false },
};
