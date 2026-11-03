import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select";

const sizes = ["sm", "default", "lg"] as const;

const meta = {
  title: "UI/Select",
  component: SelectTrigger,
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
    "aria-label": "Role",
    className: "w-56",
  },
} satisfies Meta<typeof SelectTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Select defaultValue="editor">
      <SelectTrigger {...args}>
        <SelectValue placeholder="Pick a role" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="owner">Owner</SelectItem>
        <SelectItem value="editor">Editor</SelectItem>
        <SelectItem value="viewer">Viewer</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const Placeholder: Story = {
  render: (args) => (
    <Select>
      <SelectTrigger {...args}>
        <SelectValue placeholder="Pick a role" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="owner">Owner</SelectItem>
        <SelectItem value="editor">Editor</SelectItem>
      </SelectContent>
    </Select>
  ),
};

/** 36, 40 and 48 px high, like the three sizes of an Input. */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      {sizes.map((size) => (
        <Select key={size} defaultValue="editor">
          <SelectTrigger {...args} size={size} aria-label={`Role, ${size}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="editor">Editor ({size})</SelectItem>
          </SelectContent>
        </Select>
      ))}
    </div>
  ),
};

/** `aria-invalid` gives a danger border, and a danger focus ring. Pair it with a Field for the message. */
export const Invalid: Story = {
  args: { "aria-invalid": true },
  render: (args) => (
    <Select>
      <SelectTrigger {...args}>
        <SelectValue placeholder="Pick a role" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="owner">Owner</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => (
    <Select defaultValue="viewer">
      <SelectTrigger {...args}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="viewer">Viewer</SelectItem>
      </SelectContent>
    </Select>
  ),
};

/** The list, open: groups, a label, a separator, the selected item and a disabled one. */
export const Open: Story = {
  // While the list is open, Radix hides the page (the trigger included) from
  // assistive technology and traps the focus in the list: the trigger cannot be
  // reached, which axe cannot tell.
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  render: (args) => (
    <div className="h-80">
      <Select defaultOpen defaultValue="editor">
        <SelectTrigger {...args}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Members</SelectLabel>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="editor">Editor</SelectItem>
            <SelectItem value="viewer" disabled>
              Viewer
            </SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Guests</SelectLabel>
            <SelectItem value="guest">Guest</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  ),
};

/** A long French value in a narrow trigger: it is cut with an ellipsis, and the chevron stays. */
export const LongLabel: Story = {
  args: { className: "w-48" },
  render: (args) => (
    <Select defaultValue="long">
      <SelectTrigger {...args}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="long">
          Administrateur de l'espace de travail et de la facturation
        </SelectItem>
        <SelectItem value="short">Lecteur</SelectItem>
      </SelectContent>
    </Select>
  ),
};
