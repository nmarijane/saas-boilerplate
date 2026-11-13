import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { CheckoutReturn } from "./checkout-return";

// The waiting screen: the story's server action is a stub that never says the payment is in,
// so the screen stays on the wait (a minute later it would say the payment is late).
const meta = {
  title: "Features/Billing/CheckoutReturn",
  component: CheckoutReturn,
  tags: ["autodocs"],
  args: { sessionId: "cs_1" },
  parameters: { layout: "centered", nextjs: { appDirectory: true, navigation: { pathname: "/settings/billing" } }, },
} satisfies Meta<typeof CheckoutReturn>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Waiting: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("heading", { level: 1, name: "Confirming your payment…" })).toBeVisible();
  },
};
