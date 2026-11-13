import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { TopUpDialog } from "./top-up-dialog";

const meta = {
  title: "Features/Billing/TopUpDialog",
  component: TopUpDialog,
  tags: ["autodocs"],
  args: { orgId: "org_1", currency: "usd" },
  parameters: {
    layout: "centered",
    nextjs: { appDirectory: true, navigation: { pathname: "/settings/billing" } },
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
} satisfies Meta<typeof TopUpDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** One choice among the packs, one button: the payment opens in the checkout page. */
export const Opens: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Top up credits" }));

    const dialog = within(await within(document.body).findByRole("dialog"));
    await expect(dialog.getByRole("radio", { name: /1,000 credits/ })).toBeChecked();
    await waitFor(() => expect(dialog.getByRole("button", { name: "Continue to payment" })).toBeVisible());
  },
};
