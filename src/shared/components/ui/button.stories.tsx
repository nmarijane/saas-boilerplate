import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PlusIcon, RefreshCwIcon } from "lucide-react";

import { Button } from "./button";

const variants = [
  "default",
  "destructive",
  "outline",
  "secondary",
  "ghost",
  "link",
] as const;

const meta = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: variants,
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon", "icon-sm"],
    },
    disabled: {
      control: "boolean",
    },
    loading: {
      control: "boolean",
    },
    loadingText: {
      control: "text",
    },
    disabledReason: {
      control: "text",
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: "Button" },
};

export const Destructive: Story = {
  args: { children: "Delete", variant: "destructive" },
};

export const Outline: Story = {
  args: { children: "Outline", variant: "outline" },
};

export const Secondary: Story = {
  args: { children: "Secondary", variant: "secondary" },
};

export const Ghost: Story = {
  args: { children: "Ghost", variant: "ghost" },
};

export const Link: Story = {
  args: { children: "Link", variant: "link" },
};

export const Small: Story = {
  args: { children: "Small", size: "sm" },
};

export const Large: Story = {
  args: { children: "Large", size: "lg" },
};

export const Disabled: Story = {
  args: { children: "Disabled", disabled: true },
};

/** Every variant, at rest and disabled. */
export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {[false, true].map((disabled) => (
        <div
          key={String(disabled)}
          className="flex flex-wrap items-center gap-3"
        >
          {variants.map((variant) => (
            <Button key={variant} variant={variant} disabled={disabled}>
              {variant}
            </Button>
          ))}
        </div>
      ))}
    </div>
  ),
};

/** Every size, with a text button and an icon button of each. */
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">Small</Button>
      <Button>Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon-sm" variant="outline" aria-label="Add">
        <PlusIcon />
      </Button>
      <Button size="icon" variant="outline" aria-label="Add">
        <PlusIcon />
      </Button>
      <Button>
        <PlusIcon />
        With an icon
      </Button>
    </div>
  ),
};

export const Loading: Story = {
  args: { children: "Save", loading: true },
};

export const LoadingWithText: Story = {
  args: { children: "Save", loading: true, loadingText: "Saving" },
};

/** The spinner takes the place of the leading icon. */
export const LoadingWithIcon: Story = {
  render: () => (
    <Button loading>
      <PlusIcon />
      Add member
    </Button>
  ),
};

/** An icon button shows only the spinner, and keeps its `aria-label`. */
export const LoadingIcon: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button size="icon" variant="outline" aria-label="Refresh" loading>
        <RefreshCwIcon />
      </Button>
      <Button size="icon-sm" variant="outline" aria-label="Refresh" loading>
        <RefreshCwIcon />
      </Button>
    </div>
  ),
};

/** Hover or focus the button: the reason shows in a tooltip. */
export const DisabledWithReason: Story = {
  args: {
    children: "Delete",
    variant: "destructive",
    disabled: true,
    disabledReason: "Only owners can delete a project",
  },
};

/** A long French label: the button grows with it. */
export const LongLabel: Story = {
  args: { children: "Enregistrer les modifications du profil" },
};
