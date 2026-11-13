import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { PricingFaq } from "./pricing-faq";

const meta = {
  title: "Features/Billing/PricingFaq",
  component: PricingFaq,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof PricingFaq>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Native disclosures: they open with the keyboard and need no script. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const question = canvas.getByText("Can I cancel at any time?");

    await userEvent.click(question);

    await expect(canvas.getByText(/You keep your plan until the end of the period/)).toBeVisible();
  },
};
