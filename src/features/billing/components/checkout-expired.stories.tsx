import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { CheckoutExpired } from "./checkout-expired";

const meta = {
  title: "Features/Billing/CheckoutExpired",
  component: CheckoutExpired,
  tags: ["autodocs"],
  args: { href: "/choose-plan" },
  parameters: { layout: "centered" },
} satisfies Meta<typeof CheckoutExpired>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("heading", { level: 1, name: "This payment has expired" })).toBeVisible();
  },
};
