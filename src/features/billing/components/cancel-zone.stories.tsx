import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Toaster } from "@/shared/components/ui/sonner";
import { CancelZone, ResumeButton } from "./cancel-zone";

const meta = {
  title: "Features/Billing/CancelZone",
  component: CancelZone,
  tags: ["autodocs"],
  args: { orgId: "org_1", planName: "Pro", endsAt: new Date("2026-12-14T00:00:00Z") },
  parameters: {
    layout: "padded",
    nextjs: { appDirectory: true, navigation: { pathname: "/settings/billing" } },
    // While a dialog is open, Radix hides the page from assistive technology
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  decorators: [
    (Story) => (
      <div className="max-w-3xl">
        <Story />
        <Toaster />
      </div>
    ),
  ],
} satisfies Meta<typeof CancelZone>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Cancelling is confirmed, and the dialog says what happens: the plan is kept until the end of the period. */
export const Confirms: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Cancel subscription" }));

    const dialog = within(await within(document.body).findByRole("alertdialog"));
    // The dialog fades in: it is in the page before it can be seen
    await waitFor(() => expect(dialog.getByText(/keeps the plan until December 14, 2026/)).toBeVisible());
    await expect(dialog.getByRole("button", { name: "Cancel subscription" })).toBeVisible();
  },
};

export const Resume: Story = {
  render: () => <ResumeButton orgId="org_1" />,
};
