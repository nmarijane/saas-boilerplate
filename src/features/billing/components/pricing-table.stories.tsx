import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PricingTable } from "./pricing-table";

const meta = {
  title: "Features/PricingTable",
  component: PricingTable,
  tags: ["autodocs"],
  args: {
    onSelectPlan: () => {},
  },
  argTypes: {
    onSelectPlan: { action: "onSelectPlan" },
  },
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div className="p-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PricingTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithCurrentPlan: Story = {
  args: {
    currentPlanId: "pro",
  },
};

export const FreePlanSelected: Story = {
  args: {
    currentPlanId: "free",
  },
};

export const EnterprisePlanSelected: Story = {
  args: {
    currentPlanId: "enterprise",
  },
};
