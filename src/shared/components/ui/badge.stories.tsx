import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Badge } from "./badge";

const variants = [
  "neutral",
  "brand",
  "success",
  "warning",
  "danger",
  "outline",
] as const;

// The shadcn names, kept for the existing call sites.
const aliases = ["default", "secondary", "destructive"] as const;

const meta = {
  title: "UI/Badge",
  component: Badge,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: [...variants, ...aliases],
    },
    size: {
      control: "inline-radio",
      options: ["sm", "md"],
    },
    dot: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: "Badge" },
};

export const Neutral: Story = {
  args: { children: "Neutral", variant: "neutral" },
};

export const Brand: Story = {
  args: { children: "Brand", variant: "brand" },
};

export const Success: Story = {
  args: { children: "Success", variant: "success" },
};

export const Warning: Story = {
  args: { children: "Almost out", variant: "warning" },
};

export const Danger: Story = {
  args: { children: "Limit reached", variant: "danger" },
};

export const Outline: Story = {
  args: { children: "v2.0", variant: "outline" },
};

/** Every variant, in both sizes. */
export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {(["sm", "md"] as const).map((size) => (
        <div key={size} className="flex flex-wrap items-center gap-3">
          {variants.map((variant) => (
            <Badge key={variant} variant={variant} size={size}>
              {variant}
            </Badge>
          ))}
        </div>
      ))}
    </div>
  ),
};

/** A dot before the label, so a status is never told by color alone. */
export const WithDot: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      {variants.map((variant) => (
        <Badge key={variant} variant={variant} dot>
          {variant}
        </Badge>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge size="sm">Small</Badge>
      <Badge size="md">Medium</Badge>
    </div>
  ),
};

/** The shadcn names, as the existing call sites use them. */
export const Aliases: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      {aliases.map((variant) => (
        <Badge key={variant} variant={variant}>
          {variant}
        </Badge>
      ))}
    </div>
  ),
};

/** A long French label: the badge grows with it, on one line. */
export const LongLabel: Story = {
  args: { children: "Enregistrer les modifications du profil", dot: true },
};
