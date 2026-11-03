import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Spinner } from "./spinner";

const sizes = ["xs", "sm", "md"] as const;

const meta = {
  title: "UI/Spinner",
  component: Spinner,
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "inline-radio",
      options: sizes,
    },
    label: {
      control: "text",
    },
  },
  args: { size: "sm" },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 16 px, in the color of the text around it. Screen readers hear the translated "Loading": switch the language in the toolbar. */
export const Default: Story = {};

/** 12, 16 (the default) and 20 px. */
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-6 text-meta text-ink-muted">
      {sizes.map((size) => (
        <div key={size} className="flex items-center gap-2">
          <Spinner size={size} />
          {size}
        </div>
      ))}
    </div>
  ),
};

/** The label is for assistive technology: nothing is drawn, and a screen reader announces it as a status. Set one when "Loading" is too vague. */
export const WithLabel: Story = {
  args: { label: "Syncing your projects" },
};

/** Beside text that already says what is happening, an empty label keeps the status from being announced twice. */
export const BesideText: Story = {
  render: () => (
    <p className="flex items-center gap-2 text-body text-ink-muted">
      <Spinner label="" />
      Importing your projects
    </p>
  ),
};
