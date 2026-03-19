import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FeedbackModal } from "./feedback-modal";

const meta = {
  title: "Features/FeedbackModal",
  component: FeedbackModal,
  tags: ["autodocs"],
  args: {
    open: true,
    onOpenChange: () => {},
    userId: "user_123",
    orgId: "org_456",
  },
  argTypes: {
    onOpenChange: { action: "onOpenChange" },
  },
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof FeedbackModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Closed: Story = {
  args: {
    open: false,
  },
};
