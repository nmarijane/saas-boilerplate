import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { InfoIcon } from "lucide-react";

import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

const meta = {
  title: "UI/Tooltip",
  component: TooltipContent,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="flex min-h-32 items-end justify-center">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TooltipContent>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Open when the story loads. It appears on hover and on keyboard focus. */
export const Default: Story = {
  render: () => (
    <Tooltip defaultOpen>
      <TooltipTrigger asChild>
        <Button variant="outline" size="icon" aria-label="About quotas">
          <InfoIcon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Quotas reset on the first of the month.</TooltipContent>
    </Tooltip>
  ),
};

/** It wraps at 320 px. */
export const LongText: Story = {
  render: () => (
    <Tooltip defaultOpen>
      <TooltipTrigger asChild>
        <Button variant="outline" size="icon" aria-label="About quotas">
          <InfoIcon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        Files that fail to upload do not count against your storage, and neither
        do the ones you delete within a minute.
      </TooltipContent>
    </Tooltip>
  ),
};
