import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { Toaster } from "@/shared/components/ui/sonner";
import { getPaidPlans } from "../plans";
import { ChangePlanDialog } from "./change-plan-dialog";

const meta = {
  title: "Features/Billing/ChangePlanDialog",
  component: ChangePlanDialog,
  tags: ["autodocs"],
  args: {
    orgId: "org_1",
    plans: getPaidPlans(),
    currentPlanId: "pro",
    currentInterval: "monthly",
    currency: "usd",
    usage: { members: 4, projects: 12, storage: 250 },
  },
  parameters: {
    layout: "centered",
    nextjs: { appDirectory: true, navigation: { pathname: "/settings/billing" } },
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  decorators: [
    (Story) => (
      <>
        <Story />
        <Toaster />
      </>
    ),
  ],
} satisfies Meta<typeof ChangePlanDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The current plan is marked, and Confirm waits for another choice: nothing to confirm otherwise. */
export const Opens: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Change plan" }));

    const dialog = within(await within(document.body).findByRole("dialog"));
    await expect(dialog.getByRole("radio", { name: /Pro \(current\)/ })).toBeChecked();
    await expect(dialog.getByRole("button", { name: "Confirm the change" })).toBeDisabled();
  },
};
