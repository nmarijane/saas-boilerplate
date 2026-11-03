import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Card, CardContent } from "./card";
import { Skeleton } from "./skeleton";

const meta = {
  title: "UI/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
  args: { className: "h-4 w-48" },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A block in the hairline color, which pulses. A class sizes it: this one is `h-4 w-48`. The pulse stops for those who ask for reduced motion. */
export const Default: Story = {};

/** A round avatar and two lines of text, on a card. */
export const Shapes: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <Card>
      <CardContent className="flex items-center gap-3">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </CardContent>
    </Card>
  ),
};

/** One color for every placeholder: it shows on a card (1.26:1 against the surface) and on the page itself (1.17:1 in light mode). The track color, 1.04:1 on the page, would not show there. */
export const OnASurfaceAndOnThePage: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-2">
          <p className="text-caption text-ink-muted">On a card</p>
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
      <div className="space-y-2">
        <p className="text-caption text-ink-muted">On the page</p>
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  ),
};
