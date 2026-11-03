import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Input } from "./input";

const sizes = ["sm", "default", "lg"] as const;

const meta = {
  title: "UI/Input",
  component: Input,
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "inline-radio",
      options: sizes,
    },
    disabled: {
      control: "boolean",
    },
    readOnly: {
      control: "boolean",
    },
    "aria-invalid": {
      control: "boolean",
    },
  },
  args: {
    "aria-label": "Email",
    placeholder: "you@example.com",
  },
  decorators: [
    (Story) => (
      <div className="w-80 max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithValue: Story = {
  args: { defaultValue: "ada@example.com" },
};

/** 36, 40 and 48 px high. Under 768 px the text is 16 px, so iOS does not zoom the page. */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      {sizes.map((size) => (
        <Input key={size} {...args} size={size} placeholder={size} />
      ))}
    </div>
  ),
};

/** `aria-invalid` gives a danger border, and a danger focus ring. Pair it with a Field for the message. */
export const Invalid: Story = {
  args: { defaultValue: "ada@", "aria-invalid": true },
};

export const Disabled: Story = {
  args: { defaultValue: "ada@example.com", disabled: true },
};

export const ReadOnly: Story = {
  args: { defaultValue: "https://example.com/invite/9f2c", readOnly: true },
};

export const FileInput: Story = {
  args: { type: "file", "aria-label": "Avatar" },
};

/** A long French placeholder in a narrow field: it is cut at the edge, nothing overflows. */
export const LongLabel: Story = {
  args: {
    placeholder:
      "Saisissez l'adresse e-mail professionnelle de la personne que vous souhaitez inviter",
  },
  decorators: [
    (Story) => (
      <div className="w-64 max-w-full">
        <Story />
      </div>
    ),
  ],
};
