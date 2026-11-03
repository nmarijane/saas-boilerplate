import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Textarea } from "./textarea";

const sizes = ["sm", "default", "lg"] as const;

const meta = {
  title: "UI/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "inline-radio",
      options: sizes,
    },
    disabled: {
      control: "boolean",
    },
    "aria-invalid": {
      control: "boolean",
    },
  },
  args: {
    "aria-label": "Message",
    placeholder: "Tell us more",
  },
  decorators: [
    (Story) => (
      <div className="w-80 max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      {sizes.map((size) => (
        <Textarea key={size} {...args} size={size} placeholder={size} />
      ))}
    </div>
  ),
};

/** `aria-invalid` gives a danger border, and a danger focus ring. Pair it with a Field for the message. */
export const Invalid: Story = {
  args: { defaultValue: "Too short", "aria-invalid": true },
};

export const Disabled: Story = {
  args: { defaultValue: "This note is locked.", disabled: true },
};

/** A long French text in a narrow field: it wraps, and the field grows with the rows. */
export const LongLabel: Story = {
  args: {
    rows: 4,
    defaultValue:
      "Nous avons constaté que l'export des factures du mois dernier ne contient pas les avoirs émis après le quinze, alors que le total affiché dans le tableau de bord les prend bien en compte.",
  },
  decorators: [
    (Story) => (
      <div className="w-64 max-w-full">
        <Story />
      </div>
    ),
  ],
};
