import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { MINIMAL_VIEWPORTS } from "storybook/viewport";
import { PLANS } from "../plans";
import { PricingComparison } from "./pricing-comparison";

const meta = {
  title: "Features/Billing/PricingComparison",
  component: PricingComparison,
  tags: ["autodocs"],
  args: { plans: PLANS },
  parameters: { layout: "padded", viewport: { options: MINIMAL_VIEWPORTS } },
} satisfies Meta<typeof PricingComparison>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A real table: plans in columns, one row per limit and feature, read cell by cell. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const table = canvas.getByRole("table");

    await expect(within(table).getAllByRole("columnheader")).toHaveLength(PLANS.length + 1);
    await expect(within(table).getByRole("rowheader", { name: "API access" })).toBeVisible();
  },
};

/** On a phone it scrolls inside its box, which a keyboard can reach. */
export const Phone: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("region", { name: "Compare the plans" })).toHaveAttribute("tabindex", "0");
  },
};
